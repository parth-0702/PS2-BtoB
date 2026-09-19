"""
analysis.py — Spatial analysis endpoints (DBSCAN, isochrones, polygon).
"""

from __future__ import annotations

import math

import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel

from app.routers.cities import _load_hexes
from app.services.spatial import (
    dbscan_clusters,
    isochrone_circle,
    reachable_population,
)

router = APIRouter(prefix="/analysis", tags=["analysis"])


class ClusterRequest(BaseModel):
    city_id: str
    eps_km: float = 0.5
    min_samples: int = 3


class IsochroneRequest(BaseModel):
    city_id: str
    lat: float
    lng: float
    mode: str = "drive"
    minutes: list[int] = [10, 20, 30]


class PolygonRequest(BaseModel):
    city_id: str
    polygon: list[list[float]]  # [[lng, lat], ...]
    scored_hexes: list[dict] | None = None


@router.post("/clusters")
def get_clusters(req: ClusterRequest):
    df = _load_hexes(req.city_id)
    # Use hexes with high competition as competitor proxies
    comp_hexes = df[df["competitor_count"] > 3]
    pts = list(zip(comp_hexes["lng"].tolist(), comp_hexes["lat"].tolist()))
    clusters = dbscan_clusters(pts, eps_km=req.eps_km, min_samples=req.min_samples)
    return {"clusters": clusters, "total": len(clusters)}


@router.post("/isochrone")
def get_isochrone(req: IsochroneRequest):
    df = _load_hexes(req.city_id)
    bands = []
    for mins in sorted(req.minutes):
        speed = 4.8 if req.mode == "walk" else 25.0
        radius_km = (speed * mins) / 60
        ring = isochrone_circle((req.lng, req.lat), radius_km)
        reach = reachable_population(df, (req.lng, req.lat), mins, req.mode)
        bands.append({
            "minutes": mins,
            "polygon": ring,
            **reach,
        })
    return {"center": [req.lng, req.lat], "mode": req.mode, "bands": bands}


def _point_in_polygon(pt: list[float], poly: list[list[float]]) -> bool:
    x, y = pt
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < ((xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


@router.post("/polygon")
def polygon_analysis(req: PolygonRequest):
    df = _load_hexes(req.city_id)
    inside_mask = df.apply(lambda r: _point_in_polygon([r["lng"], r["lat"]], req.polygon), axis=1)
    inside = df[inside_mask]
    if inside.empty:
        return {"hex_count": 0, "avg_score": 0, "population": 0}

    scored = req.scored_hexes or []
    score_map = {h["h3"]: h.get("score", 0) for h in scored} if scored else {}
    scores = [score_map.get(h3, 0) for h3 in inside["h3"]] if score_map else [50.0] * len(inside)

    lu_counts = inside["landuse_dominant"].value_counts().to_dict()

    return {
        "hex_count": len(inside),
        "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "best_score": round(max(scores), 1) if scores else 0,
        "population": int(inside["pop"].sum()) if "pop" in inside else 0,
        "competitor_count": int(inside["competitor_count"].sum()),
        "landuse_mix": lu_counts,
    }
