"""
scoring.py — Vectorised site-readiness scoring engine.

All operations use pandas/numpy so a full city recomputes in < 300 ms.
"""

from __future__ import annotations

import math
from typing import Literal

import numpy as np
import pandas as pd
from pydantic import BaseModel


# ── Config models ────────────────────────────────────────────────────────────

class DecayConfig(BaseModel):
    type: Literal["exponential", "gaussian", "linear"] = "exponential"
    d0_km: float = 1.0


class CompetitionConfig(BaseModel):
    mode: Literal["penalise", "cluster_bonus"] = "penalise"
    radius_km: float = 1.0
    saturation: float = 5.0
    sweet_spot: float = 3.0


class Constraint(BaseModel):
    feature: str
    op: Literal["<=", ">=", "==", "!=", "in", "not_in"]
    value: float | str | list
    label: str


class ScoringConfig(BaseModel):
    preset: str = "retail_store"
    weights: dict[str, float] = {
        "demand": 25, "accessibility": 20, "complementary": 15,
        "competition": 20, "landuse": 10, "risk": 10,
    }
    decay: DecayConfig = DecayConfig()
    competition: CompetitionConfig = CompetitionConfig()
    constraints: list[Constraint] = []


# ── Presets ──────────────────────────────────────────────────────────────────

PRESETS: dict[str, dict] = {
    "retail_store":      {"demand": 30, "accessibility": 20, "complementary": 10, "competition": 15, "landuse": 15, "risk": 10},
    "ev_charging":       {"demand": 15, "accessibility": 30, "complementary": 15, "competition": 15, "landuse": 10, "risk": 15},
    "pharmacy":          {"demand": 30, "accessibility": 15, "complementary": 10, "competition": 25, "landuse": 10, "risk": 10},
    "cloud_kitchen":     {"demand": 30, "accessibility": 20, "complementary":  5, "competition": 20, "landuse": 10, "risk": 15},
    "warehouse":         {"demand":  5, "accessibility": 35, "complementary":  5, "competition":  5, "landuse": 30, "risk": 20},
    "telecom_tower":     {"demand": 30, "accessibility": 10, "complementary":  0, "competition": 20, "landuse": 25, "risk": 15},
    "renewable_energy":  {"demand":  5, "accessibility": 20, "complementary":  0, "competition":  5, "landuse": 40, "risk": 30},
    # wizard-compatible presets
    "cafe":              {"demand": 25, "accessibility": 20, "complementary": 15, "competition": 20, "landuse": 10, "risk": 10},
    "restaurant":        {"demand": 25, "accessibility": 20, "complementary": 10, "competition": 20, "landuse": 15, "risk": 10},
    "grocery":           {"demand": 35, "accessibility": 15, "complementary":  5, "competition": 25, "landuse": 10, "risk": 10},
    "gym":               {"demand": 25, "accessibility": 20, "complementary": 10, "competition": 20, "landuse": 15, "risk": 10},
    "salon":             {"demand": 20, "accessibility": 20, "complementary": 15, "competition": 20, "landuse": 15, "risk": 10},
    "clinic":            {"demand": 30, "accessibility": 15, "complementary": 10, "competition": 20, "landuse": 15, "risk": 10},
}

LANDUSE_SCORES: dict[str, dict[str, float]] = {
    "retail_store":     {"commercial": 1.0, "mixed": 0.85, "residential": 0.5, "industrial": 0.1, "green": 0.2},
    "ev_charging":      {"commercial": 0.9, "mixed": 0.85, "residential": 0.6, "industrial": 0.8, "green": 0.3},
    "pharmacy":         {"commercial": 1.0, "mixed": 0.9,  "residential": 0.7, "industrial": 0.1, "green": 0.1},
    "cloud_kitchen":    {"commercial": 0.9, "mixed": 0.8,  "residential": 0.4, "industrial": 0.6, "green": 0.1},
    "warehouse":        {"commercial": 0.4, "mixed": 0.5,  "residential": 0.1, "industrial": 1.0, "green": 0.2},
    "telecom_tower":    {"commercial": 0.7, "mixed": 0.7,  "residential": 0.6, "industrial": 0.9, "green": 0.8},
    "renewable_energy": {"commercial": 0.2, "mixed": 0.3,  "residential": 0.1, "industrial": 0.5, "green": 1.0},
}
DEFAULT_LANDUSE = {"commercial": 1.0, "mixed": 0.8, "residential": 0.6, "industrial": 0.3, "green": 0.2}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _norm(s: pd.Series, lo_pct: float = 5, hi_pct: float = 95) -> pd.Series:
    lo, hi = np.percentile(s.dropna(), [lo_pct, hi_pct])
    if hi == lo:
        return pd.Series(0.5, index=s.index)
    return ((s - lo) / (hi - lo)).clip(0, 1)


def _decay(d_km: pd.Series, cfg: DecayConfig) -> pd.Series:
    d0 = max(cfg.d0_km, 0.01)
    if cfg.type == "exponential":
        return np.exp(-d_km / d0)
    if cfg.type == "gaussian":
        return np.exp(-((d_km / d0) ** 2))
    # linear
    return (1 - d_km / d0).clip(0, 1)


# ── Sub-scores ────────────────────────────────────────────────────────────────

def _s_demand(df: pd.DataFrame, cfg: ScoringConfig) -> pd.Series:
    pop = _norm(df["pop"])
    density = _norm(df["pop_density"])
    income = df.get("income_index", pd.Series(0.5, index=df.index))
    # decay applied via transit/road distance proxy
    d_km = df["transit_dist_m"] / 1000
    decay = _decay(d_km, cfg.decay)
    base = 0.5 * pop + 0.3 * density + 0.2 * income
    return (base * (0.6 + 0.4 * decay)).clip(0, 1)


def _s_accessibility(df: pd.DataFrame, cfg: ScoringConfig) -> pd.Series:
    road = _norm(df["road_len_km"])
    d_major = _decay(df["major_road_dist_m"] / 1000, cfg.decay)
    d_transit = _decay(df["transit_dist_m"] / 1000, cfg.decay)
    return (0.5 * road + 0.3 * d_major + 0.2 * d_transit).clip(0, 1)


def _s_complementary(df: pd.DataFrame, cfg: ScoringConfig) -> pd.Series:
    return _norm(df["complementary_count"])


def _s_competition(df: pd.DataFrame, cfg: ScoringConfig) -> pd.Series:
    comp_cfg = cfg.competition
    k = _norm(df["competitor_count"])
    if comp_cfg.mode == "cluster_bonus":
        sweet = comp_cfg.sweet_spot / max(df["competitor_count"].max(), 1)
        above = k > sweet
        s = k.copy()
        s[above] = (1 - 0.5 * (k[above] - sweet) / max(sweet, 0.01)).clip(0, 1)
        return s
    # penalise
    sat_norm = comp_cfg.saturation / max(df["competitor_count"].max(), 1)
    return (1 - (k / max(sat_norm, 0.01))).clip(0, 1)


def _s_landuse(df: pd.DataFrame, cfg: ScoringConfig) -> pd.Series:
    table = LANDUSE_SCORES.get(cfg.preset, DEFAULT_LANDUSE)
    base = df["landuse_dominant"].map(table).fillna(0.5)
    blend = 0.7 * base + 0.3 * df.get("landuse_commercial_share", pd.Series(0.5, index=df.index))
    return blend.clip(0, 1)


def _s_risk(df: pd.DataFrame, _cfg: ScoringConfig) -> pd.Series:
    flood = df.get("flood_risk", pd.Series(0.3, index=df.index))
    aqi = df.get("aqi_index", pd.Series(0.3, index=df.index))
    return (1 - (0.6 * flood + 0.4 * aqi)).clip(0, 1)


# ── Constraint checker ────────────────────────────────────────────────────────

def _check_constraints(df: pd.DataFrame, constraints: list[Constraint]) -> pd.Series:
    """Returns a series of comma-separated blocked reasons (empty = eligible)."""
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
            mask = ~col.isin(c.value)
        elif c.op == "not_in":
            mask = col.isin(c.value)
        else:
            continue
        for idx in df.index[mask]:
            blocked[idx].append(c.label)
    return pd.Series({i: ", ".join(v) for i, v in blocked.items()}, index=df.index)


# ── Gi* hot-spot ─────────────────────────────────────────────────────────────

def _gi_star(scores: pd.Series, h3_ids: pd.Series, k: int = 2) -> pd.Series:
    """Simplified Gi* z-score using mean/std of k-ring neighbours."""
    import h3 as h3lib
    score_map = dict(zip(h3_ids, scores))
    global_mean = scores.mean()
    global_std = scores.std() or 1e-6

    z_scores = []
    for cell in h3_ids:
        neighbours = list(h3lib.k_ring(cell, k))
        vals = [score_map[n] for n in neighbours if n in score_map]
        if len(vals) < 2:
            z_scores.append(0.0)
            continue
        local_mean = np.mean(vals)
        z = (local_mean - global_mean) / (global_std / math.sqrt(len(vals)))
        z_scores.append(float(z))
    return pd.Series(z_scores, index=scores.index)


# ── Main entry ────────────────────────────────────────────────────────────────

def score_city(df: pd.DataFrame, cfg: ScoringConfig) -> pd.DataFrame:
    """Score all hexes and return enriched DataFrame."""
    # Normalise weights
    w = cfg.weights.copy()
    total = sum(w.values()) or 1.0
    w = {k: v / total for k, v in w.items()}

    # Sub-scores
    sub = {
        "demand":        _s_demand(df, cfg),
        "accessibility": _s_accessibility(df, cfg),
        "complementary": _s_complementary(df, cfg),
        "competition":   _s_competition(df, cfg),
        "landuse":       _s_landuse(df, cfg),
        "risk":          _s_risk(df, cfg),
    }

    # Weighted sum → 0-100
    score = sum(sub[k] * w.get(k, 0) for k in sub) * 100

    blocked = _check_constraints(df, cfg.constraints)
    eligible = blocked == ""
    score = score.where(eligible, 0.0)

    result = df[["h3", "lat", "lng"]].copy()
    result["score"] = score.round(1)
    result["eligible"] = eligible
    result["blocked_by"] = blocked
    for k, v in sub.items():
        result[f"sub_{k}"] = (v * 100).round(1)

    # Gi* z-score
    result["gi_z"] = _gi_star(result["score"], df["h3"])
    result["hotspot"] = pd.cut(
        result["gi_z"],
        bins=[-np.inf, -2.58, -1.96, -1.65, 1.65, 1.96, 2.58, np.inf],
        labels=["cold99", "cold95", "cold90", "neutral", "hot90", "hot95", "hot99"],
    )

    # Underserved: high demand, low competition
    dem_pct = result["sub_demand"].rank(pct=True)
    comp_pct = result["sub_competition"].rank(pct=True)
    result["underserved"] = (dem_pct > 0.65) & (comp_pct > 0.65)
    result["high_potential"] = result["eligible"] & (result["score"] >= result["score"].quantile(0.9)) & (result["gi_z"] > 1.65)

    return result
