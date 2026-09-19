"""
spatial.py — DBSCAN competitor clustering.
"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN


def _haversine_matrix(lnglats: np.ndarray) -> np.ndarray:
    """Pairwise haversine distances in km."""
    R = 6371.0
    lat = np.radians(lnglats[:, 1])
    lng = np.radians(lnglats[:, 0])
    n = len(lat)
    D = np.zeros((n, n))
    for i in range(n):
        dlat = lat - lat[i]
        dlng = lng - lng[i]
        a = np.sin(dlat / 2) ** 2 + np.cos(lat[i]) * np.cos(lat) * np.sin(dlng / 2) ** 2
        D[i] = 2 * R * np.arcsin(np.sqrt(a.clip(0, 1)))
    return D


def dbscan_clusters(
    competitor_lnglats: list[tuple[float, float]],
    eps_km: float = 0.5,
    min_samples: int = 3,
) -> list[dict]:
    """
    Run DBSCAN on competitor locations.
    Returns list of clusters: {id, points, hull, centroid, size}.
    """
    if len(competitor_lnglats) < min_samples:
        return []

    pts = np.array(competitor_lnglats)
    D = _haversine_matrix(pts)
    db = DBSCAN(eps=eps_km, min_samples=min_samples, metric="precomputed")
    labels = db.fit_predict(D)

    clusters = []
    for label in set(labels):
        if label == -1:
            continue
        mask = labels == label
        cluster_pts = pts[mask].tolist()
        hull = _convex_hull(cluster_pts)
        centroid = [
            float(np.mean([p[0] for p in cluster_pts])),
            float(np.mean([p[1] for p in cluster_pts])),
        ]
        clusters.append({
            "id": int(label),
            "size": int(mask.sum()),
            "points": cluster_pts,
            "hull": hull,
            "centroid": centroid,
        })
    return clusters


def _cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def _convex_hull(pts: list) -> list:
    p = sorted(set(map(tuple, pts)))
    if len(p) <= 1:
        return [list(p[0])] if p else []
    lower: list = []
    for pt in p:
        while len(lower) >= 2 and _cross(lower[-2], lower[-1], pt) <= 0:
            lower.pop()
        lower.append(pt)
    upper: list = []
    for pt in reversed(p):
        while len(upper) >= 2 and _cross(upper[-2], upper[-1], pt) <= 0:
            upper.pop()
        upper.append(pt)
    hull = lower[:-1] + upper[:-1]
    hull.append(hull[0])  # close ring
    return [list(p) for p in hull]


def isochrone_circle(
    center: tuple[float, float],
    radius_km: float,
    steps: int = 64,
) -> list[tuple[float, float]]:
    """Approximate isochrone as a circle polygon."""
    lng, lat = center
    pts = []
    for i in range(steps + 1):
        angle = (i / steps) * 2 * math.pi
        dx = (radius_km * math.cos(angle)) / (111 * math.cos(math.radians(lat)))
        dy = (radius_km * math.sin(angle)) / 111
        pts.append([lng + dx, lat + dy])
    return pts


def reachable_population(
    scored_df: pd.DataFrame,
    center: tuple[float, float],
    minutes: int,
    mode: str,
) -> dict:
    """Estimate reachable population for a travel-time circle."""
    speed_kmh = 4.8 if mode == "walk" else 25.0
    radius_km = (speed_kmh * minutes) / 60

    lng, lat = center
    dx = (scored_df["lng"] - lng) * 111 * math.cos(math.radians(lat))
    dy = (scored_df["lat"] - lat) * 111
    dist = np.sqrt(dx**2 + dy**2)

    inside = dist <= radius_km
    pop_col = "pop" if "pop" in scored_df.columns else "raw_footfall"
    people = int(scored_df.loc[inside, pop_col].sum()) if pop_col == "pop" else int(scored_df.loc[inside, pop_col].sum() * 4200)
    area_km2 = round(math.pi * radius_km**2, 2)

    return {
        "minutes": minutes,
        "mode": mode,
        "radius_km": round(radius_km, 2),
        "hex_count": int(inside.sum()),
        "population": people,
        "area_km2": area_km2,
    }
