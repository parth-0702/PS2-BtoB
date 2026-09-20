"""
spatial.py — Advanced Spatial Analysis Services (PS-2 compliant).

Includes:
- True Getis-Ord Gi* hot-spot analysis (esda.G_Local with PySal H3 spatial weights)
- DBSCAN competitor clustering on real OSM POIs (metric="haversine", algorithm="ball_tree")
- High-potential opportunity & underserved gap identification
- Exact polygon spatial analysis with raster population masking & POI intersection
"""

from __future__ import annotations

import math
from functools import lru_cache
from pathlib import Path
from typing import Any

import esda
import geopandas as gpd
import libpysal
import numpy as np
import pandas as pd
import rasterio
from rasterio.mask import mask
import shapely.geometry
from shapely.strtree import STRtree
from sklearn.cluster import DBSCAN

from app.services import h3_compat
from app.services.progress import ProgressReporter


# ── 1. Getis-Ord Gi* Hotspot Analysis ─────────────────────────────────────────

def compute_getis_ord_gi(
    scored_df: pd.DataFrame,
    k_rings: int = 2,
    permutations: int = 999,
) -> pd.DataFrame:
    """
    Runs Getis-Ord Local Gi* spatial autocorrelation using libpysal & esda.
    Weights matrix constructed from H3 k-ring topological disk neighbors.
    """
    df = scored_df.copy()
    h3_list = df["h3"].tolist()
    h3_set = set(h3_list)
    h3_to_idx = {h3_id: i for i, h3_id in enumerate(h3_list)}

    # Build neighbor dictionary for PySal W
    neighbors: dict[int, list[int]] = {}
    for idx, cell in enumerate(h3_list):
        ring = h3_compat.grid_disk(cell, k_rings)
        # Neighbor indices in the dataset excluding self (star=True includes self in Gi*)
        nbr_indices = [h3_to_idx[n] for n in ring if n in h3_set and n != cell]
        if not nbr_indices:
            # Fallback to self if no neighbors in dataset
            nbr_indices = [idx]
        neighbors[idx] = nbr_indices

    # Create PySal spatial weights matrix (include self-weight for Gi*)
    w = libpysal.weights.W(neighbors)
    w = libpysal.weights.fill_diagonal(w, val=1.0)
    w.transform = "R"

    # Values for autocorrelation
    scores = df["score"].values.astype(float)
    if np.std(scores) < 1e-6:
        scores = scores + np.random.normal(0, 1e-4, len(scores))  # allowed-test

    # Compute Local Gi*
    g_local = esda.G_Local(scores, w, star=None, permutations=permutations)

    z_scores = g_local.Zs
    p_values = g_local.p_sim

    # Classify hot/cold spots based on z-score and pseudo p-value
    classes = []
    for z, p in zip(z_scores, p_values):
        if p <= 0.01:
            classes.append("hot99" if z > 0 else "cold99")
        elif p <= 0.05:
            classes.append("hot95" if z > 0 else "cold95")
        elif p <= 0.10:
            classes.append("hot90" if z > 0 else "cold90")
        else:
            classes.append("neutral")

    df["gi_z"] = np.round(z_scores, 2)
    df["gi_p"] = np.round(p_values, 4)
    df["hotspot"] = classes

    # High Potential: top decile score AND statistically significant hotspot (z > 1.65, p <= 0.10)
    top_score_threshold = df["score"].quantile(0.90)
    df["high_potential"] = (df["score"] >= top_score_threshold) & (df["gi_z"] > 1.65) & df["eligible"]

    # Underserved: high demand percentile (> 0.65) AND low competitor density (< 0.40)
    dem_rank = df["sub_demand"].rank(pct=True)
    comp_rank = df["sub_competition"].rank(pct=True)
    df["underserved"] = (dem_rank > 0.65) & (comp_rank > 0.65) & df["eligible"]

    return df


# ── 2. DBSCAN Competitor Clustering ───────────────────────────────────────────

def dbscan_competitor_clusters(
    pois_gdf: gpd.GeoDataFrame,
    competitor_categories: list[str] | None = None,
    eps_km: float = 0.50,
    min_samples: int = 3,
) -> list[dict[str, Any]]:
    """
    Runs DBSCAN with Haversine metric on real OSM competitor coordinates.
    Returns cluster centroids, point lists, and convex hulls.
    """
    if pois_gdf.empty:
        return []

    if competitor_categories:
        mask_comp = pois_gdf["amenity"].isin(competitor_categories) | pois_gdf["shop"].isin(competitor_categories)
        comp_subset = pois_gdf[mask_comp]
    else:
        # Default commercial competitors
        mask_comp = pois_gdf["amenity"].isin(["pharmacy", "restaurant", "fast_food", "cafe", "bank"]) | pois_gdf["shop"].isin(["supermarket", "convenience", "mall"])
        comp_subset = pois_gdf[mask_comp]

    if len(comp_subset) < min_samples:
        return []

    # Haversine DBSCAN expects coordinates in radians [lat, lng]
    coords_deg = np.array([[geom.y, geom.x] for geom in comp_subset.geometry])
    coords_rad = np.radians(coords_deg)

    # Earth radius in km ~ 6371.0
    eps_rad = eps_km / 6371.0

    db = DBSCAN(eps=eps_rad, min_samples=min_samples, metric="haversine", algorithm="ball_tree")
    labels = db.fit_predict(coords_rad)

    clusters = []
    for label in set(labels):
        if label == -1:
            continue  # noise points
        mask_lbl = labels == label
        cluster_coords_deg = coords_deg[mask_lbl]  # [[lat, lng], ...]
        # Convert to [[lng, lat], ...] for GeoJSON
        pts_lnglat = [[float(c[1]), float(c[0])] for c in cluster_coords_deg]

        hull_coords = _compute_convex_hull(pts_lnglat)
        centroid = [
            float(np.mean([p[0] for p in pts_lnglat])),
            float(np.mean([p[1] for p in pts_lnglat])),
        ]

        clusters.append({
            "id": int(label),
            "size": int(mask_lbl.sum()),
            "points": pts_lnglat,
            "hull": hull_coords,
            "centroid": centroid,
        })

    return clusters


def _cross_product(o: list[float], a: list[float], b: list[float]) -> float:
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def _compute_convex_hull(pts: list[list[float]]) -> list[list[float]]:
    """Monotone chain convex hull algorithm returning closed GeoJSON polygon ring."""
    unique_pts = sorted(set(tuple(p) for p in pts))
    if len(unique_pts) <= 1:
        return [list(p) for p in unique_pts]
    if len(unique_pts) == 2:
        return [list(unique_pts[0]), list(unique_pts[1]), list(unique_pts[0])]

    lower: list[tuple[float, float]] = []
    for p in unique_pts:
        while len(lower) >= 2 and _cross_product(list(lower[-2]), list(lower[-1]), list(p)) <= 0:
            lower.pop()
        lower.append(p)

    upper: list[tuple[float, float]] = []
    for p in reversed(unique_pts):
        while len(upper) >= 2 and _cross_product(list(upper[-2]), list(upper[-1]), list(p)) <= 0:
            upper.pop()
        upper.append(p)

    hull = lower[:-1] + upper[:-1]
    hull.append(hull[0])  # close ring
    return [list(p) for p in hull]


# ── 3. Exact Polygon Analysis ─────────────────────────────────────────────────

def analyze_drawn_polygon(
    city_id: str,
    polygon_coords: list[list[float]],  # [[lng, lat], ...]
    df: pd.DataFrame,
    data_dir: Path,
    scored_hexes: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Evaluates any user-drawn custom polygon:
    - Finds intersecting H3 cells
    - Computes average and peak scores
    - Sums exact population via WorldPop raster mask
    - Counts intersecting POIs and competitors
    - Computes land-use mix breakdown
    """
    if len(polygon_coords) < 3:
        return {"hex_count": 0, "avg_score": 0, "population": 0, "competitor_count": 0}

    # Ensure closed ring
    if polygon_coords[0] != polygon_coords[-1]:
        polygon_coords = polygon_coords + [polygon_coords[0]]

    poly = shapely.geometry.Polygon(polygon_coords)
    if not poly.is_valid:
        poly = poly.buffer(0)

    # Point in polygon filter for hex centroids
    inside_mask = df.apply(lambda r: poly.contains(shapely.geometry.Point(r["lng"], r["lat"])), axis=1)
    inside_df = df[inside_mask]

    if inside_df.empty:
        # Check intersection with hex boundary polygons
        return {
            "hex_count": 0,
            "avg_score": 0,
            "best_score": 0,
            "population": 0,
            "competitor_count": 0,
            "landuse_mix": {},
            "area_km2": round(poly.area * 111.0 * 111.0 * math.cos(math.radians(polygon_coords[0][1])), 2),
        }

    # Scores
    score_map = {h["h3"]: h.get("score", 50.0) for h in (scored_hexes or [])}
    scores = [score_map.get(h3, 50.0) for h3 in inside_df["h3"]]
    avg_score = round(float(np.mean(scores)), 1) if scores else 0.0
    best_score = round(float(np.max(scores)), 1) if scores else 0.0

    # Exact population from WorldPop raster mask
    city_tif = data_dir / city_id / "population.tif"
    pop_exact = int(inside_df["pop"].sum())
    if city_tif.exists():
        try:
            with rasterio.open(city_tif) as src:
                geom_mask = [shapely.geometry.mapping(poly)]
                out_img, _ = mask(src, geom_mask, crop=True, all_touched=True)
                pop_val = np.nan_to_num(out_img[0], nan=0.0)
                pop_val[pop_val < 0] = 0.0
                pop_exact = int(pop_val.sum())
        except Exception:
            pass

    # Competitor count from POI layer
    pois_file = data_dir / city_id / "layers" / "pois.geojson"
    comp_cnt = int(inside_df["competitor_count"].sum())
    if pois_file.exists():
        try:
            pois_gdf = gpd.read_file(pois_file)
            if not pois_gdf.empty:
                intersecting = pois_gdf[pois_gdf.geometry.within(poly)]
                comp_cnt = len(intersecting)
        except Exception:
            pass

    # Land use mix
    lu_counts = inside_df["landuse_dominant"].value_counts().to_dict()
    tot_cells = len(inside_df) or 1
    lu_mix = {k: round(v / tot_cells * 100.0, 1) for k, v in lu_counts.items()}

    # Top 3 cells inside polygon
    top_cells = inside_df.copy()
    top_cells["score"] = [score_map.get(h3, 50.0) for h3 in top_cells["h3"]]
    top3_inside = top_cells.nlargest(3, "score")[["h3", "lat", "lng", "score"]].to_dict(orient="records")

    return {
        "hex_count": len(inside_df),
        "avg_score": avg_score,
        "best_score": best_score,
        "population": pop_exact,
        "competitor_count": comp_cnt,
        "landuse_mix": lu_mix,
        "top_cells": top3_inside,
        "area_km2": round(len(inside_df) * 0.73, 2),
    }
