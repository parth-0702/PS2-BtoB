"""
analysis.py — Spatial analysis endpoints (Getis-Ord Gi*, POI DBSCAN, Polygon Analysis, Isochrones, and Live SSE Stream).
"""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import Any

import geopandas as gpd
import pandas as pd
import shapely.geometry
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.routers.cities import _load_hexes, DATA_DIR
from app.services.spatial import (
    compute_getis_ord_gi,
    dbscan_competitor_clusters,
    analyze_drawn_polygon,
)
from app.services.routing import compute_isochrones
from app.services.scoring import ScoringConfig, score_city_dataset

router = APIRouter(prefix="/analysis", tags=["analysis"])


class IsochroneRequest(BaseModel):
    city_id: str
    lat: float
    lng: float
    mode: str = Field(default="drive", pattern="^(drive|walk)$")
    minutes: list[int] = Field(default_factory=lambda: [10, 20, 30])


class HotspotsRequest(BaseModel):
    city_id: str
    config: ScoringConfig = ScoringConfig()
    k_rings: int = 2
    permutations: int = 999


class ClusterRequest(BaseModel):
    city_id: str
    categories: list[str] | None = None
    eps_km: float = 0.50
    min_samples: int = 3


class PolygonRequest(BaseModel):
    city_id: str
    polygon: list[list[float]]  # [[lng, lat], ...]
    scored_hexes: list[dict[str, Any]] | None = None


class StreamAnalysisRequest(BaseModel):
    city_id: str
    config: ScoringConfig = ScoringConfig()
    k_rings: int = 2
    permutations: int = 999


@router.post("/hotspots")
def get_hotspots(req: HotspotsRequest):
    df = _load_hexes(req.city_id)
    scored_df, summary = score_city_dataset(df, req.config)
    analyzed = compute_getis_ord_gi(scored_df, k_rings=req.k_rings, permutations=req.permutations)

    cols = ["h3", "lat", "lng", "score", "gi_z", "gi_p", "hotspot", "high_potential", "underserved", "eligible"]
    records = analyzed[cols].to_dict(orient="records")

    counts = analyzed["hotspot"].value_counts().to_dict()
    return {
        "summary": {
            "total_hexes": len(analyzed),
            "high_potential_count": int(analyzed["high_potential"].sum()),
            "underserved_count": int(analyzed["underserved"].sum()),
            "hotspot_distribution": counts,
        },
        "hexes": records,
    }


@router.post("/clusters")
def get_clusters(req: ClusterRequest):
    pois_path = DATA_DIR / req.city_id / "layers" / "pois.geojson"
    if not pois_path.exists():
        df = _load_hexes(req.city_id)
        comp_df = df[df["competitor_count"] > 0]
        pts = [shapely.geometry.Point(r["lng"], r["lat"]) for _, r in comp_df.iterrows()]
        pois_gdf = gpd.GeoDataFrame(comp_df, geometry=pts, crs="EPSG:4326")
    else:
        pois_gdf = gpd.read_file(pois_path)

    clusters = dbscan_competitor_clusters(
        pois_gdf=pois_gdf,
        competitor_categories=req.categories,
        eps_km=req.eps_km,
        min_samples=req.min_samples,
    )
    return {"clusters": clusters, "total": len(clusters)}


@router.post("/underserved")
def get_underserved(req: HotspotsRequest):
    df = _load_hexes(req.city_id)
    scored_df, summary = score_city_dataset(df, req.config)
    analyzed = compute_getis_ord_gi(scored_df, k_rings=req.k_rings, permutations=req.permutations)
    underserved = analyzed[analyzed["underserved"]]

    return {
        "total_underserved": len(underserved),
        "hexes": underserved[["h3", "lat", "lng", "score", "sub_demand", "sub_competition", "comp_density_k", "saturation_index"]].to_dict(orient="records"),
    }


@router.post("/polygon")
def polygon_analysis(req: PolygonRequest):
    df = _load_hexes(req.city_id)
    result = analyze_drawn_polygon(
        city_id=req.city_id,
        polygon_coords=req.polygon,
        df=df,
        data_dir=DATA_DIR,
        scored_hexes=req.scored_hexes,
    )
    return result


@router.post("/isochrone")
def get_isochrones(req: IsochroneRequest):
    try:
        result = compute_isochrones(
            city_id=req.city_id,
            lat=req.lat,
            lng=req.lng,
            mode=req.mode,  # type: ignore
            minutes=req.minutes,
            data_dir=DATA_DIR,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stream")
async def stream_analysis(req: StreamAnalysisRequest):
    """
    Real-time Server-Sent Events (SSE) processing log stream.
    Emits true step events and final result payload without synthetic delays.
    """
    async def event_generator():
        t0 = time.perf_counter()

        def format_sse(data: dict[str, Any], event_name: str | None = None) -> str:
            msg = ""
            if event_name:
                msg += f"event: {event_name}\n"
            msg += f"data: {json.dumps(data)}\n\n"
            return msg

        try:
            # 1. Load data
            t_step = time.perf_counter()
            df = _load_hexes(req.city_id)
            elapsed_load = int((time.perf_counter() - t_step) * 1000)
            yield format_sse({
                "stage": "Data Loading",
                "level": "info",
                "progress": 0.20,
                "message": f"Loaded {len(df):,} H3 hexagons from {req.city_id} feature store ({elapsed_load}ms)",
                "elapsed_ms": int((time.perf_counter() - t0) * 1000),
            })
            await asyncio.sleep(0.01)

            # 2. Score City
            t_step = time.perf_counter()
            scored_df, summary = score_city_dataset(df, req.config)
            elapsed_score = int((time.perf_counter() - t_step) * 1000)
            yield format_sse({
                "stage": "Readiness Scoring",
                "level": "success",
                "progress": 0.45,
                "message": f"Evaluated 5th-95th robust normalization & decay kernel in {elapsed_score}ms. Mean score: {summary['mean_score']:.1f}/100",
                "elapsed_ms": int((time.perf_counter() - t0) * 1000),
            })
            await asyncio.sleep(0.01)

            # 3. Getis-Ord Gi* Spatial Statistics
            t_step = time.perf_counter()
            analyzed = compute_getis_ord_gi(scored_df, k_rings=req.k_rings, permutations=req.permutations)
            elapsed_gi = int((time.perf_counter() - t_step) * 1000)
            hp_count = int(analyzed["high_potential"].sum())
            yield format_sse({
                "stage": "Spatial Autocorrelation",
                "level": "success",
                "progress": 0.70,
                "message": f"Computed Getis-Ord Gi* with PySal k={req.k_rings} rings ({req.permutations} permutations) in {elapsed_gi}ms: {hp_count} high-potential opportunity zones identified",
                "elapsed_ms": int((time.perf_counter() - t0) * 1000),
            })
            await asyncio.sleep(0.01)

            # 4. Competitor DBSCAN
            t_step = time.perf_counter()
            pois_path = DATA_DIR / req.city_id / "layers" / "pois.geojson"
            if pois_path.exists():
                pois_gdf = gpd.read_file(pois_path)
                clusters = dbscan_competitor_clusters(pois_gdf=pois_gdf, eps_km=0.5, min_samples=3)
                elapsed_dbscan = int((time.perf_counter() - t_step) * 1000)
                yield format_sse({
                    "stage": "Cluster Analysis",
                    "level": "info",
                    "progress": 0.90,
                    "message": f"Identified {len(clusters)} competitor clusters from {len(pois_gdf):,} OSM POIs via Haversine DBSCAN ({elapsed_dbscan}ms)",
                    "elapsed_ms": int((time.perf_counter() - t0) * 1000),
                })
            await asyncio.sleep(0.01)

            # 5. Complete
            total_elapsed = int((time.perf_counter() - t0) * 1000)
            cols = ["h3", "lat", "lng", "score", "sub_demand", "sub_transit", "sub_footfall", "sub_competition", "sub_risk", "gi_z", "gi_p", "hotspot", "high_potential", "underserved", "eligible"]
            final_records = analyzed[cols].to_dict(orient="records")

            yield format_sse({
                "stage": "Complete",
                "level": "success",
                "progress": 1.0,
                "message": f"Pipeline completed in {total_elapsed}ms across {len(analyzed):,} sites",
                "elapsed_ms": total_elapsed,
                "summary": summary,
                "hexes": final_records,
            }, event_name="complete")

        except Exception as e:
            yield format_sse({
                "stage": "Error",
                "level": "error",
                "progress": 1.0,
                "message": f"Pipeline error: {str(e)}",
                "elapsed_ms": int((time.perf_counter() - t0) * 1000),
            }, event_name="error")

    return StreamingResponse(event_generator(), media_type="text/event-stream")


class ReportRequest(BaseModel):
    city_id: str
    business_type: str = "Retail Store"
    config: ScoringConfig = ScoringConfig()
    ai_explanation: dict[str, Any] | None = None


@router.post("/report")
def export_pdf_report(req: ReportRequest):
    from fastapi import Response
    from app.services.report import generate_pdf_report
    from app.routers.cities import _load_meta

    try:
        df = _load_hexes(req.city_id)
        scored_df, summary = score_city_dataset(df, req.config)
        top_sites = scored_df.sort_values(by="score", ascending=False).head(10).to_dict(orient="records")
        meta = _load_meta(req.city_id)
        city_name = meta.get("name", req.city_id.title())

        pdf_bytes = generate_pdf_report(
            city_name=city_name,
            business_type=req.business_type,
            score_summary=summary,
            top_sites=top_sites,
            ai_explanation=req.ai_explanation,
            provenance_meta=meta,
        )

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=SiteScope_Report_{req.city_id}.pdf"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
