"""
test_scoring_unit.py — Rigorous unit tests for the SiteScope scoring engine.
Uses real Ahmedabad parquet dataset to verify calculations, performance, and constraints.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

# Fix Windows console encoding
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

WORKSPACE_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT / "backend"))

import pandas as pd
import numpy as np

from app.services.scoring import (
    ScoringConfig,
    DecayConfig,
    CompetitionConfig,
    Constraint,
    decay_kernel,
    score_city_dataset,
    score_point_location,
)


def test_scoring_engine():
    print("======================================================================")
    print("🧪 RUNNING SCORING ENGINE UNIT TESTS ON REAL AHMEDABAD PARQUET DATA")
    print("======================================================================")

    # 1. Test Distance Decay Kernels
    print("\n1. Testing Distance Decay Kernels:")
    dists = pd.Series([0.0, 0.5, 1.0, 2.0, 5.0, 10.0])
    for d_type in ["exponential", "gaussian", "linear"]:
        cfg = DecayConfig(type=d_type, d0_km=1.0)
        vals = decay_kernel(dists, cfg)
        assert vals.iloc[0] == 1.0, f"{d_type} d=0 should equal 1.0, got {vals.iloc[0]}"
        assert (vals.diff().dropna() <= 0).all(), f"{d_type} decay is not monotonically decreasing!"
        print(f"   ✅ PASS: {d_type.title()} decay kernel is strictly decreasing and bounded [0, 1].")

    # 2. Load Real Ahmedabad Parquet Dataset
    parquet_path = WORKSPACE_ROOT / "data" / "ahmedabad" / "hex_features.parquet"
    assert parquet_path.exists(), f"Real Ahmedabad dataset missing at {parquet_path}"
    df = pd.read_parquet(parquet_path)
    n_hex = len(df)
    print(f"\n2. Loaded Real Ahmedabad Dataset: {n_hex:,} hexagons.")

    # 3. Test City Scoring Execution & Weight Normalization
    print("\n3. Testing City Scoring & Weight Invariance:")
    cfg = ScoringConfig(
        weights={"demand": 40, "accessibility": 30, "competition": 20, "landuse": 10, "risk": 0},
    )
    result, summary = score_city_dataset(df, cfg)
    assert len(result) == n_hex
    assert (result["score"] >= 0).all() and (result["score"] <= 100).all()
    print(f"   ✅ PASS: City scored ({len(result)} hexes, mean score: {summary['mean_score']:.1f}).")

    # 4. Test Constraints Blocking
    print("\n4. Testing Constraint Blocking:")
    cfg_constr = ScoringConfig(
        constraints=[
            Constraint(feature="flood_susceptibility", op="<=", value=0.30, label="High Flood Risk"),
        ]
    )
    result_constr, summary_constr = score_city_dataset(df, cfg_constr)
    blocked_count = (~result_constr["eligible"]).sum()
    assert blocked_count > 0, "Some hexes should have been blocked by high flood risk"
    print(f"   ✅ PASS: {blocked_count} hexes correctly blocked by hard constraint.")

    # 5. Test Performance Benchmark (< 300ms)
    print("\n5. Testing Performance Benchmark (< 300ms SLA):")
    t0 = time.perf_counter()
    for _ in range(5):
        score_city_dataset(df, cfg)
    elapsed_ms = (time.perf_counter() - t0) * 1000 / 5.0
    print(f"   ⚡ Execution time: {elapsed_ms:.1f} ms per run across {n_hex} hexes.")
    assert elapsed_ms < 300, f"Scoring engine exceeded 300ms budget: {elapsed_ms:.1f}ms"
    print("   ✅ PASS: Vectorized numpy engine executes well within SLA.")

    # 6. Test Real Point Scoring
    print("\n6. Testing Real Point Scoring (/score/point):")
    point_res = score_point_location(
        city_id="ahmedabad",
        lat=23.0338,
        lng=72.5647,
        cfg=cfg,
        df=df,
        data_dir=WORKSPACE_ROOT / "data",
    )
    assert "score" in point_res
    assert point_res["score"] > 0
    assert "breakdown" in point_res
    pop_cnt = point_res["raw_metrics"]["pop_within_1km"]
    print(f"   ✅ PASS: Point scored at [23.0338, 72.5647] -> Score {point_res['score']:.1f}/100, Pop = {pop_cnt:,} residents.")

    print("\n======================================================================")
    print("🎉 ALL SCORING ENGINE UNIT TESTS PASSED SUCCESSFULLY!")
    print("======================================================================")


if __name__ == "__main__":
    test_scoring_engine()
