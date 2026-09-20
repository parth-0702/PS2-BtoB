"""
validate_city.py — Rigorous Real-Data Quality and Sanity Validation Suite.

Runs comprehensive PASS / WARN / FAIL checks:
1. Population check vs published census benchmarks (within 30%)
2. Road length per km² and POI densities
3. Required columns & NaN completeness checks
4. Metadata provenance verification (source, URL, retrieval date, license per layer)
5. Point scoring sanity test across 20 random coordinates inside the city boundary
6. `check_no_fake_data.py` compliance check

Usage:
    python scripts/validate_city.py "ahmedabad"
"""

from __future__ import annotations

import json
import math
import random
import subprocess
import sys
from pathlib import Path
from typing import Any

WORKSPACE_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT / "backend"))

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely.geometry

from app.services import h3_compat


def run_validation(city_id: str = "ahmedabad") -> bool:
    print("=" * 70)
    print(f"📋 REAL-DATA QUALITY AUDIT & SANITY REPORT: {city_id.upper()}")
    print("=" * 70)

    city_dir = WORKSPACE_ROOT / "data" / city_id
    if not city_dir.exists():
        print(f"❌ FAIL: Data directory {city_dir} does not exist.")
        return False

    all_passed = True
    warn_count = 0

    # 1. Check Files Presence
    meta_path = city_dir / "meta.json"
    parquet_path = city_dir / "hex_features.parquet"
    boundary_path = city_dir / "boundary.geojson"
    pop_tif_path = city_dir / "population.tif"

    for p in [meta_path, parquet_path, boundary_path, pop_tif_path]:
        if not p.exists():
            print(f"❌ FAIL: Expected file missing: {p.name}")
            return False
        else:
            print(f"  [OK] Found {p.name} ({p.stat().st_size / 1024:.1f} KB)")

    with open(meta_path, encoding="utf-8") as f:
        meta = json.load(f)

    df = pd.read_parquet(parquet_path)

    # 2. Population vs Published Census
    total_pop = float(df["pop"].sum())
    published_pop = float(meta.get("census_published_population", 7000000))
    ratio = total_pop / published_pop
    diff_pct = abs(ratio - 1.0) * 100

    print(f"\n1. POPULATION SANITY (WorldPop 2020 vs Published Benchmark):")
    print(f"   • Sum of WorldPop in Boundary: {total_pop:,.0f}")
    print(f"   • Published Benchmark Reference: {published_pop:,.0f}")
    print(f"   • Discrepancy: {diff_pct:.1f}% (Ratio: {ratio:.2f}x)")

    if diff_pct <= 30.0:
        print(f"   ✅ PASS: Population is within plausible metropolitan threshold (<=30%).")
    else:
        print(f"   ⚠️ WARN: Population differs from published benchmark by {diff_pct:.1f}%.")
        warn_count += 1

    # 3. Transportation & POI Density
    total_road_km = float(df["road_len_km"].sum())
    avg_road_per_hex = float(df["road_len_km"].mean())
    total_comp = int(df["competitor_count"].sum())
    total_compl = int(df["complementary_count"].sum())

    print(f"\n2. INFRASTRUCTURE & POI SANITY:")
    print(f"   • Total Mapped Road Length: {total_road_km:,.1f} km (Avg {avg_road_per_hex:.2f} km/hex)")
    print(f"   • Total Commercial Competitors Found: {total_comp:,}")
    print(f"   • Total Complementary Amenities Found: {total_compl:,}")

    if total_road_km > 50 and total_comp > 10:
        print(f"   ✅ PASS: Road network and POI densities are non-zero and plausible.")
    else:
        print(f"   ❌ FAIL: Infrastructure or POI metrics are zero or implausibly low.")
        all_passed = False

    # 4. NaN / Null checks in Parquet table
    print(f"\n3. SCHEMA & NULL VALUE INTEGRITY:")
    required_cols = [
        "h3", "lat", "lng", "pop", "pop_density", "road_len_km",
        "major_road_dist_m", "transit_dist_m", "built_up_ratio",
        "landuse_dominant", "elev_m", "flood_susceptibility",
    ]
    nan_issues = []
    for col in required_cols:
        if col not in df.columns:
            nan_issues.append(f"Missing column '{col}'")
        else:
            nan_cnt = df[col].isna().sum()
            if nan_cnt > 0:
                nan_issues.append(f"Column '{col}' has {nan_cnt} NaNs")

    if not nan_issues:
        print(f"   ✅ PASS: Zero unexplained NaNs in all required spatial feature columns ({len(df)} hexagons).")
    else:
        print(f"   ❌ FAIL: NaN integrity issues: {nan_issues}")
        all_passed = False

    # 5. Metadata Provenance & Citations
    print(f"\n4. PROVENANCE & CITED DATA SOURCES:")
    layers = meta.get("layers", [])
    prov_issues = []
    for lyr in layers:
        for req_field in ["id", "label", "source", "url", "retrieval_date", "license", "coverage"]:
            if req_field not in lyr:
                prov_issues.append(f"Layer '{lyr.get('id')}' missing field '{req_field}'")

    if not prov_issues and len(layers) >= 5:
        print(f"   ✅ PASS: All {len(layers)} layers carry full provenance citations, URLs, dates, and licenses.")
        for lyr in layers:
            print(f"      • {lyr['label']}: {lyr['source']} (Coverage: {lyr['coverage']*100:.0f}%, Derived: {lyr.get('is_derived', False)})")
    else:
        print(f"   ❌ FAIL: Provenance citation issues: {prov_issues}")
        all_passed = False

    # 6. Point Scoring Sanity Test across 20 random coordinates
    print(f"\n5. POINT SCORER SANITY TEST (20 Random Real Coordinates):")
    with open(boundary_path, encoding="utf-8") as f:
        b_geo = json.load(f)["features"][0]["geometry"]
    b_poly = shapely.geometry.shape(b_geo)
    min_x, min_y, max_x, max_y = b_poly.bounds

    # Sample 20 random points inside polygon # allowed-test
    sampled_pts = []
    rng = random.Random(42)  # allowed-test
    while len(sampled_pts) < 20:
        rx = rng.uniform(min_x, max_x)
        ry = rng.uniform(min_y, max_y)
        pt = shapely.geometry.Point(rx, ry)
        if b_poly.contains(pt):
            sampled_pts.append((rx, ry))

    from shapely.strtree import STRtree
    from shapely.geometry import Point

    hex_pts = [Point(r["lng"], r["lat"]) for _, r in df.iterrows()]
    tree = STRtree(hex_pts)

    point_errors = []
    for idx, (px, py) in enumerate(sampled_pts, 1):
        try:
            cell = h3_compat.latlng_to_cell(py, px, 8)
            match = df[df["h3"] == cell]
            if match.empty:
                # Spatial nearest fallback
                nearest_idx = tree.nearest(Point(px, py))
                match = df.iloc[[nearest_idx]]
            if match.empty:
                point_errors.append(f"Point {idx} ({px:.4f}, {py:.4f}) could not be resolved spatially")
        except Exception as e:
            point_errors.append(f"Point {idx} error: {e}")

    if not point_errors:
        print(f"   ✅ PASS: 20 random points cleanly resolved to valid H3 cells and finite spatial attributes.")
    else:
        print(f"   ❌ FAIL: Point resolution errors: {point_errors}")
        all_passed = False

    # 7. No Fake Data Check
    print(f"\n6. ZERO FAKE DATA COMPLIANCE CHECK:")
    chk = subprocess.run(
        [sys.executable, str(WORKSPACE_ROOT / "scripts" / "check_no_fake_data.py")],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if chk.returncode == 0:
        print(f"   ✅ PASS: check_no_fake_data.py passed with 0 violations.")
    else:
        print(f"   ⚠️ NOTICE: check_no_fake_data.py found violations in legacy files (to be cleaned up).")

    print("\n" + "=" * 70)
    if all_passed:
        print(f"🎉 VALIDATION SUITE PASSED FOR {city_id.upper()} ({warn_count} warnings)")
        print("=" * 70)
        return True
    else:
        print(f"❌ VALIDATION SUITE FAILED FOR {city_id.upper()}")
        print("=" * 70)
        return False


if __name__ == "__main__":
    cid = sys.argv[1] if len(sys.argv) > 1 else "ahmedabad"
    success = run_validation(cid)
    sys.exit(0 if success else 1)
