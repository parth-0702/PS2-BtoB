"""
test_routing_unit.py — Unit test for Multi-Tier Routing & Isochrones.
"""

import sys
from pathlib import Path

# Fix Windows console encoding
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.services.routing import compute_isochrones


def test_isochrones():
    print("Testing multi-tier isochrone computation...")
    # Center of Ahmedabad (near Navrangpura / CG Road)
    lat = 23.0338
    lng = 72.5647

    res = compute_isochrones(
        city_id="ahmedabad",
        lat=lat,
        lng=lng,
        mode="drive",
        minutes=[10, 20],
        data_dir=Path(__file__).parent.parent / "data",
    )

    print(f"Provider used: {res['provider_used']}")
    print(f"Elapsed: {res['elapsed_ms']} ms")
    print(f"Bands count: {len(res['bands'])}")

    assert len(res["bands"]) == 2, f"Expected 2 bands, got {len(res['bands'])}"
    for band in res["bands"]:
        print(f"  - {band['minutes']} min: Area = {band['area_km2']} km², Pop = {band['population']:,}, Competitors = {band['competitors_within_band']}")
        assert band["area_km2"] > 0, "Catchment area must be > 0"
        assert band["population"] > 0, "Reachable population must be > 0"
        assert "polygon" in band, "Polygon coordinates missing"

    # Band 2 must be larger than Band 1
    assert res["bands"][1]["area_km2"] >= res["bands"][0]["area_km2"], "20 min area should be >= 10 min area"
    assert res["bands"][1]["population"] >= res["bands"][0]["population"], "20 min population should be >= 10 min population"

    print("\n✅ All routing & isochrone tests PASSED!")


if __name__ == "__main__":
    test_isochrones()
