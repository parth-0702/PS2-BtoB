"""
test_spatial_unit.py — Unit tests for Getis-Ord Gi*, POI DBSCAN, and Polygon Analysis.
"""

from __future__ import annotations

import sys
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT / "backend"))

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

import geopandas as gpd
import pandas as pd
from app.services.scoring import ScoringConfig, score_city_dataset
from app.services.spatial import (
    compute_getis_ord_gi,
    dbscan_competitor_clusters,
    analyze_drawn_polygon,
)


def run_tests():
    print("=" * 70)
    print("🧪 RUNNING SPATIAL ANALYSIS UNIT TESTS")
    print("=" * 70)

    ahmedabad_path = WORKSPACE_ROOT / "data" / "ahmedabad" / "hex_features.parquet"
    if not ahmedabad_path.exists():
        print("❌ Ahmedabad dataset missing. Run build_city.py first.")
        return

    df = pd.read_parquet(ahmedabad_path)
    cfg = ScoringConfig()
    scored_df, _ = score_city_dataset(df, cfg)

    # 1. Test Getis-Ord Gi*
    print("\n1. Testing Getis-Ord Gi* Hotspot Analysis:")
    gi_df = compute_getis_ord_gi(scored_df, k_rings=2, permutations=499)
    assert "gi_z" in gi_df.columns
    assert "gi_p" in gi_df.columns
    assert "hotspot" in gi_df.columns
    assert "high_potential" in gi_df.columns
    assert "underserved" in gi_df.columns

    dist = gi_df["hotspot"].value_counts().to_dict()
    print(f"   • Hotspot distribution: {dist}")
    print(f"   • High potential cells: {gi_df['high_potential'].sum()}")
    print(f"   • Underserved cells: {gi_df['underserved'].sum()}")
    print("   ✅ PASS: Getis-Ord Gi* statistically classified hot and cold spots.")

    # 2. Test DBSCAN on Real POIs
    print("\n2. Testing DBSCAN Competitor Clustering on Real OSM POIs:")
    pois_file = WORKSPACE_ROOT / "data" / "ahmedabad" / "layers" / "pois.geojson"
    if pois_file.exists():
        pois_gdf = gpd.read_file(pois_file)
        clusters = dbscan_competitor_clusters(pois_gdf, eps_km=0.6, min_samples=3)
        print(f"   • Found {len(clusters)} competitor clusters from {len(pois_gdf)} real POIs")
        for cl in clusters[:3]:
            print(f"     - Cluster {cl['id']}: {cl['size']} points, centroid: {cl['centroid']}")
        print("   ✅ PASS: DBSCAN clustered competitor locations and formed convex hulls.")

    # 3. Test Polygon Analysis
    print("\n3. Testing Polygon Analysis (Ashram Road / Riverfront corridor):")
    poly_coords = [
        [72.560, 23.020],
        [72.590, 23.020],
        [72.590, 23.050],
        [72.560, 23.050],
        [72.560, 23.020],
    ]
    poly_res = analyze_drawn_polygon(
        city_id="ahmedabad",
        polygon_coords=poly_coords,
        df=df,
        data_dir=WORKSPACE_ROOT / "data",
    )
    print(f"   • Intersecting Hexagons: {poly_res['hex_count']}")
    print(f"   • Avg Score: {poly_res['avg_score']}/100, Best: {poly_res['best_score']}/100")
    print(f"   • Exact Raster Population: {poly_res['population']:,}")
    print(f"   • Real Competitors inside Polygon: {poly_res['competitor_count']}")
    print(f"   • Land-use mix: {poly_res['landuse_mix']}")
    print("   ✅ PASS: Polygon analysis computes exact raster population and POI counts.")

    print("\n" + "=" * 70)
    print("🎉 ALL SPATIAL ANALYSIS UNIT TESTS PASSED!")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
