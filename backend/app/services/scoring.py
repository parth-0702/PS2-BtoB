"""
scoring.py — Vectorised Multi-Criteria Site Readiness Scoring Engine (PS-2 compliant).

Implements:
- 5th–95th percentile robust min-max normalization
- User-selectable distance decay kernels (exponential, gaussian, linear with d0)
- Neighborhood-smoothed demand and complementary synergy
- Competitive-density analysis (decay density K_i, saturation index S_i, penalise / cluster_bonus)
- Area-weighted land-use suitability blending
- Environmental risk with missing-factor renormalization (flood + AQI)
- Threshold constraints with blocking reasons
- Signed per-factor contribution points relative to city mean
- Exact click-anywhere point scoring from raw spatial indexes & population raster
"""

from __future__ import annotations

import math
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import numpy as np
import pandas as pd
import geopandas as gpd
from pydantic import BaseModel, Field
import rasterio
from rasterio.mask import mask
import shapely.geometry
from shapely.strtree import STRtree

from app.services import h3_compat


# ── Configuration Models ──────────────────────────────────────────────────────

class DecayConfig(BaseModel):
    type: Literal["exponential", "gaussian", "linear"] = "exponential"
    d0_km: float = Field(default=1.2, ge=0.05, le=20.0)


class CompetitionConfig(BaseModel):
    mode: Literal["penalise", "cluster_bonus"] = "penalise"
    radius_km: float = Field(default=1.0, ge=0.1, le=10.0)
    saturation: float = Field(default=5.0, ge=0.5, le=50.0)
    sweet_spot: float = Field(default=3.0, ge=0.5, le=20.0)


class Constraint(BaseModel):
    feature: str
    op: Literal["<=", ">=", "==", "!=", "in", "not_in"]
    value: float | str | list[Any]
    label: str


class ScoringConfig(BaseModel):
    preset: str = "retail_store"
    weights: dict[str, float] = {
        "demand": 30.0,
        "accessibility": 20.0,
        "complementary": 10.0,
        "competition": 15.0,
        "landuse": 15.0,
        "risk": 10.0,
    }
    decay: DecayConfig = DecayConfig()
    competition: CompetitionConfig = CompetitionConfig()
    constraints: list[Constraint] = []


# ── Presets & Land Use Suitability ────────────────────────────────────────────

PRESETS: dict[str, dict[str, Any]] = {
    "retail_store": {
        "weights": {"demand": 30, "accessibility": 20, "complementary": 10, "competition": 15, "landuse": 15, "risk": 10},
        "decay_d0": 1.2,
        "competition_mode": "penalise",
        "competition_saturation": 6.0,
    },
    "pharmacy": {
        "weights": {"demand": 30, "accessibility": 15, "complementary": 10, "competition": 25, "landuse": 10, "risk": 10},
        "decay_d0": 1.0,
        "competition_mode": "penalise",
        "competition_saturation": 4.0,
    },
    "cloud_kitchen": {
        "weights": {"demand": 30, "accessibility": 20, "complementary": 5, "competition": 20, "landuse": 10, "risk": 15},
        "decay_d0": 2.5,
        "competition_mode": "cluster_bonus",
        "competition_saturation": 8.0,
    },
    "ev_charging": {
        "weights": {"demand": 15, "accessibility": 30, "complementary": 15, "competition": 15, "landuse": 10, "risk": 15},
        "decay_d0": 2.0,
        "competition_mode": "cluster_bonus",
        "competition_saturation": 5.0,
    },
    "warehouse": {
        "weights": {"demand": 5, "accessibility": 35, "complementary": 5, "competition": 5, "landuse": 30, "risk": 20},
        "decay_d0": 4.0,
        "competition_mode": "penalise",
        "competition_saturation": 3.0,
    },
    "telecom_tower": {
        "weights": {"demand": 30, "accessibility": 10, "complementary": 0, "competition": 20, "landuse": 25, "risk": 15},
        "decay_d0": 3.0,
        "competition_mode": "penalise",
        "competition_saturation": 2.0,
    },
    "renewable_energy": {
        "weights": {"demand": 5, "accessibility": 20, "complementary": 0, "competition": 5, "landuse": 40, "risk": 30},
        "decay_d0": 5.0,
        "competition_mode": "penalise",
        "competition_saturation": 2.0,
    },
    # UI Aliases
    "cafe": {
        "weights": {"demand": 25, "accessibility": 20, "complementary": 15, "competition": 20, "landuse": 10, "risk": 10},
        "decay_d0": 0.8,
        "competition_mode": "cluster_bonus",
        "competition_saturation": 6.0,
    },
    "restaurant": {
        "weights": {"demand": 25, "accessibility": 20, "complementary": 10, "competition": 20, "landuse": 15, "risk": 10},
        "decay_d0": 1.5,
        "competition_mode": "cluster_bonus",
        "competition_saturation": 7.0,
    },
    "grocery": {
        "weights": {"demand": 35, "accessibility": 15, "complementary": 5, "competition": 25, "landuse": 10, "risk": 10},
        "decay_d0": 1.0,
        "competition_mode": "penalise",
        "competition_saturation": 5.0,
    },
    "gym": {
        "weights": {"demand": 25, "accessibility": 20, "complementary": 10, "competition": 20, "landuse": 15, "risk": 10},
        "decay_d0": 1.5,
        "competition_mode": "penalise",
        "competition_saturation": 4.0,
    },
    "salon": {
        "weights": {"demand": 20, "accessibility": 20, "complementary": 15, "competition": 20, "landuse": 15, "risk": 10},
        "decay_d0": 1.0,
        "competition_mode": "penalise",
        "competition_saturation": 5.0,
    },
    "clinic": {
        "weights": {"demand": 30, "accessibility": 15, "complementary": 10, "competition": 20, "landuse": 15, "risk": 10},
        "decay_d0": 1.2,
        "competition_mode": "penalise",
        "competition_saturation": 4.0,
    },
}

LANDUSE_SUITABILITY: dict[str, dict[str, float]] = {
    "retail_store":     {"commercial": 1.0, "mixed": 0.85, "residential": 0.50, "industrial": 0.10, "green": 0.20, "other": 0.30},
    "pharmacy":         {"commercial": 1.0, "mixed": 0.90, "residential": 0.70, "industrial": 0.10, "green": 0.10, "other": 0.30},
    "cloud_kitchen":    {"commercial": 0.9, "mixed": 0.80, "residential": 0.40, "industrial": 0.70, "green": 0.10, "other": 0.30},
    "ev_charging":      {"commercial": 0.9, "mixed": 0.85, "residential": 0.60, "industrial": 0.80, "green": 0.30, "other": 0.40},
    "warehouse":        {"commercial": 0.4, "mixed": 0.50, "residential": 0.10, "industrial": 1.00, "green": 0.20, "other": 0.30},
    "telecom_tower":    {"commercial": 0.7, "mixed": 0.70, "residential": 0.60, "industrial": 0.90, "green": 0.80, "other": 0.50},
    "renewable_energy": {"commercial": 0.2, "mixed": 0.30, "residential": 0.10, "industrial": 0.50, "green": 1.00, "other": 0.40},
}
DEFAULT_LANDUSE_SUITABILITY = {"commercial": 1.0, "mixed": 0.85, "residential": 0.55, "industrial": 0.30, "green": 0.25, "other": 0.30}


# ── Normalization & Decay Kernels ─────────────────────────────────────────────

def norm_series(s: pd.Series, lo_pct: float = 5.0, hi_pct: float = 95.0) -> pd.Series:
    """Robust 5th-95th percentile min-max normalization to 0..1 range."""
    valid = s.dropna()
    if valid.empty:
        return pd.Series(0.5, index=s.index)
    lo, hi = np.percentile(valid, [lo_pct, hi_pct])
    if hi <= lo:
        return pd.Series(0.5, index=s.index)
    return ((s - lo) / (hi - lo)).clip(0.0, 1.0)


def decay_kernel(distance_km: pd.Series | float | np.ndarray, decay_cfg: DecayConfig) -> pd.Series | float | np.ndarray:
    """
    Computes user-selectable distance decay kernel:
    - Exponential: exp(-d / d0)
    - Gaussian: exp(-(d / d0)^2)
    - Linear: max(0, 1 - d / d0)
    """
    d0 = max(decay_cfg.d0_km, 0.05)
    if decay_cfg.type == "exponential":
        return np.exp(-distance_km / d0)
    elif decay_cfg.type == "gaussian":
        return np.exp(-((distance_km / d0) ** 2))
    elif decay_cfg.type == "linear":
        return np.maximum(0.0, 1.0 - (distance_km / d0))
    return np.exp(-distance_km / d0)


# ── Sub-score Engines ─────────────────────────────────────────────────────────

def compute_demand_subscore(df: pd.DataFrame, cfg: ScoringConfig) -> pd.Series:
    """Demand: population density, total population, accessibility decay blend."""
    pop_norm = norm_series(df["pop"])
    dens_norm = norm_series(df["pop_density"])
    built_norm = norm_series(df.get("built_up_ratio", pd.Series(0.5, index=df.index)))
    
    # Neighborhood smoothing via major road / transit distance decay
    d_major_km = df["major_road_dist_m"] / 1000.0
    d_transit_km = df["transit_dist_m"] / 1000.0
    decay_access = 0.6 * decay_kernel(d_major_km, cfg.decay) + 0.4 * decay_kernel(d_transit_km, cfg.decay)

    base_demand = 0.50 * pop_norm + 0.35 * dens_norm + 0.15 * built_norm
    demand = base_demand * (0.70 + 0.30 * decay_access)
    return demand.clip(0.0, 1.0)


def compute_accessibility_subscore(df: pd.DataFrame, cfg: ScoringConfig) -> pd.Series:
    """Accessibility: road length density, distance to major highways and transit."""
    road_norm = norm_series(df["road_len_km"])
    d_major_km = df["major_road_dist_m"] / 1000.0
    d_transit_km = df["transit_dist_m"] / 1000.0

    decay_major = decay_kernel(d_major_km, cfg.decay)
    decay_transit = decay_kernel(d_transit_km, cfg.decay)

    access = 0.50 * road_norm + 0.30 * decay_major + 0.20 * decay_transit
    return access.clip(0.0, 1.0)


def compute_complementary_subscore(df: pd.DataFrame, cfg: ScoringConfig) -> pd.Series:
    """Complementary synergy: proximity and density of symbiotic footfall anchors."""
    compl_norm = norm_series(df.get("complementary_count", pd.Series(0, index=df.index)))
    comm_share = df.get("landuse_share_commercial", pd.Series(0.1, index=df.index))
    return (0.75 * compl_norm + 0.25 * comm_share).clip(0.0, 1.0)


def compute_competition_subscore(df: pd.DataFrame, cfg: ScoringConfig) -> tuple[pd.Series, pd.Series, pd.Series]:
    """
    Competitive density analysis:
    - K_i: Decay-weighted competitor density
    - S_i: Saturation index (competitors / (population / 10,000))
    - penalise vs cluster_bonus modes
    """
    comp_cfg = cfg.competition
    raw_comp = df.get("competitor_count", pd.Series(0, index=df.index))
    pop_10k = np.maximum(df["pop"] / 10000.0, 0.1)

    k_density = norm_series(raw_comp)
    saturation_index = raw_comp / pop_10k

    if comp_cfg.mode == "cluster_bonus":
        # Synergy curve: rises to sweet spot, then falls
        sweet_norm = comp_cfg.sweet_spot / max(float(raw_comp.max()), 1.0)
        s = np.exp(-((k_density - sweet_norm) ** 2) / 0.15)
        return s.clip(0.0, 1.0), k_density, saturation_index

    # Penalise mode
    sat_norm = comp_cfg.saturation / max(float(raw_comp.max()), 1.0)
    penalised = 1.0 - np.minimum(1.0, k_density / max(sat_norm, 0.05))
    return penalised.clip(0.0, 1.0), k_density, saturation_index


def compute_landuse_subscore(df: pd.DataFrame, cfg: ScoringConfig) -> pd.Series:
    """Land use suitability: weighted sum of suitability coefficients by landuse share."""
    table = LANDUSE_SUITABILITY.get(cfg.preset, DEFAULT_LANDUSE_SUITABILITY)

    comm = df.get("landuse_share_commercial", pd.Series(0.0, index=df.index)) * table["commercial"]
    res = df.get("landuse_share_residential", pd.Series(0.0, index=df.index)) * table["residential"]
    ind = df.get("landuse_share_industrial", pd.Series(0.0, index=df.index)) * table["industrial"]
    green = df.get("landuse_share_green", pd.Series(0.0, index=df.index)) * table["green"]
    other = df.get("landuse_share_other", pd.Series(0.0, index=df.index)) * table["other"]

    blended = comm + res + ind + green + other
    return blended.clip(0.0, 1.0)


def compute_risk_subscore(df: pd.DataFrame) -> tuple[pd.Series, dict[str, Any]]:
    """
    Environmental risk: flood susceptibility + air quality (if available).
    Renormalises gracefully if AQI is unavailable.
    """
    flood = df.get("flood_susceptibility", pd.Series(0.2, index=df.index))
    has_aqi = bool(df.get("has_aqi", pd.Series(False, index=df.index)).iloc[0] if "has_aqi" in df.columns else False)
    aqi_col = df.get("aqi_pm25")

    if has_aqi and aqi_col is not None and not aqi_col.isna().all():
        aqi_norm = norm_series(aqi_col)
        # Higher flood / PM2.5 => lower safety score
        safety = 1.0 - (0.60 * flood + 0.40 * aqi_norm)
        meta = {"has_flood": True, "has_aqi": True, "flood_weight": 0.60, "aqi_weight": 0.40}
    else:
        safety = 1.0 - flood
        meta = {"has_flood": True, "has_aqi": False, "flood_weight": 1.00, "aqi_weight": 0.00}

    return safety.clip(0.0, 1.0), meta


# ── Constraint Evaluation ─────────────────────────────────────────────────────

def check_constraints(df: pd.DataFrame, constraints: list[Constraint]) -> pd.Series:
    """Returns comma-separated blocked reasons string per hex (empty string = eligible)."""
    blocked: dict[int, list[str]] = {i: [] for i in df.index}
    for c in constraints:
        if c.feature not in df.columns:
            continue
        col = df[c.feature]
        if c.op == "<=":
            mask = col > c.value
        elif c.op == ">=":
            mask = col < c.value
        elif c.op == "==":
            mask = col != c.value
        elif c.op == "!=":
            mask = col == c.value
        elif c.op == "in":
            mask = ~col.isin(c.value if isinstance(c.value, list) else [c.value])
        elif c.op == "not_in":
            mask = col.isin(c.value if isinstance(c.value, list) else [c.value])
        else:
            continue
        for idx in df.index[mask]:
            blocked[idx].append(c.label)

    return pd.Series({i: ", ".join(v) for i, v in blocked.items()}, index=df.index)


# ── Main City Scoring Function ────────────────────────────────────────────────

def score_city_dataset(df: pd.DataFrame, cfg: ScoringConfig) -> tuple[pd.DataFrame, dict[str, Any]]:
    """
    Computes composite Site Readiness Score (0-100), signed factor contributions,
    and summary metrics for the full city dataset.
    """
    # 1. Weights Normalization
    raw_w = cfg.weights.copy()
    factors = ["demand", "accessibility", "complementary", "competition", "landuse", "risk"]
    tot_w = sum(raw_w.get(k, 0.0) for k in factors) or 100.0
    w = {k: raw_w.get(k, 0.0) / tot_w for k in factors}

    # 2. Compute Sub-scores (0..1)
    s_demand = compute_demand_subscore(df, cfg)
    s_access = compute_accessibility_subscore(df, cfg)
    s_compl = compute_complementary_subscore(df, cfg)
    s_comp, k_density, saturation = compute_competition_subscore(df, cfg)
    s_land = compute_landuse_subscore(df, cfg)
    s_risk, risk_meta = compute_risk_subscore(df)

    subscores = {
        "demand": s_demand,
        "accessibility": s_access,
        "complementary": s_compl,
        "competition": s_comp,
        "landuse": s_land,
        "risk": s_risk,
    }

    # 3. Composite Score (0..100)
    raw_composite = sum(subscores[k] * w[k] for k in factors) * 100.0

    # 4. Evaluate Hard Constraints
    blocked = check_constraints(df, cfg.constraints)
    eligible = blocked == ""
    final_score = raw_composite.where(eligible, 0.0).round(1)

    # 5. Calculate Signed Factor Contributions Relative to City Mean
    # delta_k = 100 * w_k * (s_ik - mean(s_k))
    city_means = {k: float(subscores[k].mean()) for k in factors}
    city_avg_score = float(final_score[eligible].mean() if eligible.any() else final_score.mean())

    result = df[["h3", "lat", "lng"]].copy()
    result["score"] = final_score
    result["eligible"] = eligible
    result["blocked_by"] = blocked
    result["comp_density_k"] = k_density.round(3)
    result["saturation_index"] = saturation.round(2)

    for k in factors:
        result[f"sub_{k}"] = (subscores[k] * 100.0).round(1)
        # Signed points contribution
        result[f"contrib_{k}"] = ((subscores[k] - city_means[k]) * w[k] * 100.0).round(1)

    summary = {
        "total_hexes": len(result),
        "eligible_hexes": int(eligible.sum()),
        "blocked_hexes": int((~eligible).sum()),
        "avg_score": round(city_avg_score, 1),
        "mean_score": round(city_avg_score, 1),
        "weights_used": {k: round(v * 100.0, 1) for k, v in w.items()},
        "city_subscore_means": {k: round(v * 100.0, 1) for k, v in city_means.items()},
        "risk_metadata": risk_meta,
    }

    return result, summary


# ── Click-Anywhere Point Scorer ───────────────────────────────────────────────

@lru_cache(maxsize=4)
def _load_city_spatial_indexes(city_id: str, data_dir: Path) -> dict[str, Any]:
    """Loads and caches spatial trees and rasters for exact point evaluation."""
    city_folder = data_dir / city_id
    layers_folder = city_folder / "layers"

    # Roads
    roads_path = layers_folder / "roads.geojson"
    roads_gdf = gpd.read_file(roads_path) if roads_path.exists() else gpd.GeoDataFrame()
    major_roads = roads_gdf[roads_gdf["highway"].isin(["motorway", "trunk", "primary", "motorway_link", "trunk_link", "primary_link"])] if not roads_gdf.empty else roads_gdf

    # Transit
    transit_path = layers_folder / "transit.geojson"
    transit_gdf = gpd.read_file(transit_path) if transit_path.exists() else gpd.GeoDataFrame()

    # POIs
    pois_path = layers_folder / "pois.geojson"
    pois_gdf = gpd.read_file(pois_path) if pois_path.exists() else gpd.GeoDataFrame()

    # Waterways
    water_path = layers_folder / "waterways.geojson"
    water_gdf = gpd.read_file(water_path) if water_path.exists() else gpd.GeoDataFrame()

    # STRtrees
    major_tree = STRtree([g for g in major_roads.geometry if g is not None and not g.is_empty]) if not major_roads.empty else None
    transit_tree = STRtree([g for g in transit_gdf.geometry if g is not None and not g.is_empty]) if not transit_gdf.empty else None
    poi_tree = STRtree([g for g in pois_gdf.geometry if g is not None and not g.is_empty]) if not pois_gdf.empty else None
    water_tree = STRtree([g for g in water_gdf.geometry if g is not None and not g.is_empty]) if not water_gdf.empty else None

    pop_tif_path = city_folder / "population.tif"

    return {
        "major_roads": major_roads,
        "major_tree": major_tree,
        "transit_gdf": transit_gdf,
        "transit_tree": transit_tree,
        "pois_gdf": pois_gdf,
        "poi_tree": poi_tree,
        "water_gdf": water_gdf,
        "water_tree": water_tree,
        "pop_tif_path": pop_tif_path,
    }


def score_point_location(
    city_id: str,
    lat: float,
    lng: float,
    cfg: ScoringConfig,
    df: pd.DataFrame,
    data_dir: Path,
) -> dict[str, Any]:
    """
    Evaluates any clicked coordinate in the metro area using exact spatial indexing
    and raster queries, returning score, breakdown, and raw ground-truth metrics.
    """
    # 1. Map to H3 cell
    cell = h3_compat.latlng_to_cell(lat, lng, 8)
    cell_row = df[df["h3"] == cell]
    if cell_row.empty:
        # Fallback to nearest cell
        dists = (df["lat"] - lat) ** 2 + (df["lng"] - lng) ** 2
        cell_row = df.loc[[dists.idxmin()]]

    # 2. Query exact spatial features
    indexes = _load_city_spatial_indexes(city_id, data_dir)
    pt = shapely.geometry.Point(lng, lat)

    # Nearest major road distance (meters)
    d_major_m = 5000.0
    if indexes["major_tree"]:
        n_idx = indexes["major_tree"].nearest(pt)
        if n_idx is not None:
            geom = indexes["major_roads"].geometry.iloc[n_idx]
            dx_m = (geom.centroid.x - lng) * 111320 * math.cos(math.radians(lat))
            dy_m = (geom.centroid.y - lat) * 110570
            d_major_m = min(10000.0, math.sqrt(dx_m * dx_m + dy_m * dy_m))

    # Nearest transit stop distance (meters)
    d_transit_m = 5000.0
    if indexes["transit_tree"]:
        n_idx = indexes["transit_tree"].nearest(pt)
        if n_idx is not None:
            geom = indexes["transit_gdf"].geometry.iloc[n_idx]
            dx_m = (geom.centroid.x - lng) * 111320 * math.cos(math.radians(lat))
            dy_m = (geom.centroid.y - lat) * 110570
            d_transit_m = min(10000.0, math.sqrt(dx_m * dx_m + dy_m * dy_m))

    # Competitors within 1.0 km radius from POI STRtree
    radius_deg = 1.0 / 111.0
    query_circle = pt.buffer(radius_deg)
    comp_count = 0
    compl_count = 0
    if indexes["poi_tree"] and not indexes["pois_gdf"].empty:
        intersecting_indices = indexes["poi_tree"].query(query_circle)
        for idx in intersecting_indices:
            row = indexes["pois_gdf"].iloc[idx]
            amenity = str(row.get("amenity", ""))
            shop = str(row.get("shop", ""))
            if amenity in ["pharmacy", "restaurant", "fast_food", "cafe"]:
                comp_count += 1
            if amenity in ["bank", "hospital", "clinic", "school", "college"] or shop in ["supermarket", "mall"]:
                compl_count += 1

    # Exact population within 1.0 km from WorldPop raster
    pop_1km = int(cell_row["pop"].iloc[0])
    pop_tif_path = indexes["pop_tif_path"]
    if pop_tif_path.exists():
        try:
            with rasterio.open(pop_tif_path) as src:
                geom_mask = [shapely.geometry.mapping(query_circle)]
                out_img, _ = mask(src, geom_mask, crop=True, all_touched=True)
                pop_val = np.nan_to_num(out_img[0], nan=0.0)
                pop_val[pop_val < 0] = 0.0
                pop_1km = int(pop_val.sum())
        except Exception:
            pass

    # Score full city to get comparative benchmarks
    scored_df, summary = score_city_dataset(df, cfg)
    matched_scored = scored_df[scored_df["h3"] == cell]
    if matched_scored.empty:
        matched_scored = scored_df.iloc[[0]]

    score = float(matched_scored["score"].iloc[0])
    eligible = bool(matched_scored["eligible"].iloc[0])
    blocked_by = str(matched_scored["blocked_by"].iloc[0])

    breakdown = []
    factors = ["demand", "accessibility", "complementary", "competition", "landuse", "risk"]
    factor_labels = {
        "demand": "Demand (Population)",
        "accessibility": "Accessibility (Transport)",
        "complementary": "Complementary POIs",
        "competition": "Competition Density",
        "landuse": "Land Use Suitability",
        "risk": "Environmental Safety",
    }

    for f in factors:
        breakdown.append({
            "factor": f,
            "label": factor_labels.get(f, f.title()),
            "weight": summary["weights_used"][f],
            "subscore": float(matched_scored[f"sub_{f}"].iloc[0]),
            "contribution_pts": float(matched_scored[f"contrib_{f}"].iloc[0]),
            "city_mean": summary["city_subscore_means"][f],
        })

    raw_metrics = {
        "h3": cell,
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "pop_within_1km": pop_1km,
        "competitors_within_1km": comp_count,
        "complementary_within_1km": compl_count,
        "nearest_major_road_m": round(d_major_m, 1),
        "nearest_transit_m": round(d_transit_m, 1),
        "dominant_landuse": str(cell_row["landuse_dominant"].iloc[0]),
        "flood_susceptibility": float(cell_row["flood_susceptibility"].iloc[0]),
        "elev_m": float(cell_row["elev_m"].iloc[0]),
    }

    return {
        "score": score,
        "eligible": eligible,
        "blocked_by": blocked_by,
        "city_avg_score": summary["avg_score"],
        "breakdown": breakdown,
        "raw_metrics": raw_metrics,
    }
