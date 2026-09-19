"""
make_synthetic_city.py — Generate realistic synthetic city data for SiteScope.

Usage:
    python scripts/make_synthetic_city.py

Outputs data/<city>/hex_features.parquet and data/<city>/meta.json for
Surat, Vadodara and Rajkot.
"""

import json
import math
import os
import random
from typing import Any

import h3
import numpy as np
import pandas as pd

# ── City seeds ──────────────────────────────────────────────────────────────

CITY_SEEDS = [
    {
        "id": "surat",
        "name": "Surat",
        "region": "Gujarat, India",
        "center": [72.8311, 21.1702],
        "rings": 14,
        "blurb": "Diamond and textile hub on the Tapi, dense core with fast-growing western suburbs.",
        "hubs": [[72.8311, 21.1702, 1.0], [72.795, 21.19, 0.85], [72.87, 21.155, 0.7], [72.79, 21.145, 0.6]],
    },
    {
        "id": "vadodara",
        "name": "Vadodara",
        "region": "Gujarat, India",
        "center": [73.1812, 22.3072],
        "rings": 11,
        "blurb": "Compact cultural city with a strong student population and a steady commercial spine.",
        "hubs": [[73.1812, 22.3072, 1.0], [73.15, 22.33, 0.72], [73.21, 22.28, 0.6]],
    },
    {
        "id": "rajkot",
        "name": "Rajkot",
        "region": "Gujarat, India",
        "center": [70.8022, 22.3039],
        "rings": 10,
        "blurb": "Fast-growing engineering town, ring-road retail and very price-sensitive tenants.",
        "hubs": [[70.8022, 22.3039, 1.0], [70.78, 22.28, 0.66], [70.83, 22.33, 0.55]],
    },
]

RES = 8  # H3 resolution


def rng_for(h3_id: str) -> np.random.Generator:
    seed = int(h3_id[-8:], 16) & 0xFFFFFFFF
    return np.random.default_rng(seed)


def hub_pull(lng: float, lat: float, hubs: list) -> float:
    v = 0.0
    for hlng, hlat, strength in hubs:
        dx = (lng - hlng) * 111 * math.cos(math.radians(lat))
        dy = (lat - hlat) * 111
        d = math.sqrt(dx * dx + dy * dy)
        v += strength * math.exp(-(d * d) / 8)
    return min(1.0, v)


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def build_city(seed: dict[str, Any]) -> tuple[pd.DataFrame, dict]:
    origin = h3.geo_to_h3(seed["center"][1], seed["center"][0], RES)
    cells = list(h3.k_ring(origin, seed["rings"]))

    rows = []
    for cell in cells:
        lat, lng = h3.h3_to_geo(cell)
        rng = rng_for(cell)
        pull = hub_pull(lng, lat, seed["hubs"])
        noise = lambda: float(rng.uniform(-0.175, 0.175))  # noqa: E731

        pop_raw = clamp(pull * 0.75 + 0.2 + noise())
        footfall = clamp(pull * 0.9 + noise())
        accessibility = clamp(pull * 0.6 + 0.3 + noise())
        complementary = clamp(footfall * 0.7 + noise())
        competition = clamp(footfall * 0.75 + noise())
        rent_raw = clamp(pull * 0.8 + 0.15 + noise() * 0.6)
        flood_risk = clamp(0.5 - pull * 0.3 + noise())
        parking = clamp(0.7 - footfall * 0.5 + noise())

        r = float(rng.uniform())
        if footfall > 0.6:
            landuse = "commercial" if r > 0.4 else "mixed"
        elif r > 0.85:
            landuse = "industrial"
        elif r > 0.5:
            landuse = "residential"
        else:
            landuse = "mixed"

        income_index = clamp(pull * 0.6 + 0.2 + noise() * 0.3)

        rows.append({
            "h3": cell,
            "lat": lat,
            "lng": lng,
            # Demand
            "pop": clamp(pop_raw) * 4200,
            "pop_density": clamp(pop_raw) * 18000,
            "income_index": income_index,
            # Accessibility
            "road_len_km": clamp(accessibility) * 8,
            "major_road_dist_m": (1 - accessibility) * 1500,
            "transit_dist_m": (1 - footfall) * 800,
            # POIs
            "competitor_count": max(0, int(competition * 12 + rng.integers(-2, 3))),
            "complementary_count": max(0, int(complementary * 10 + rng.integers(-2, 3))),
            "anchor_count": max(0, int(footfall * 4 + rng.integers(-1, 2))),
            # Land use
            "landuse_dominant": landuse,
            "landuse_commercial_share": float(
                rng.uniform(0.6, 0.95) if landuse == "commercial"
                else rng.uniform(0.2, 0.5) if landuse == "mixed"
                else rng.uniform(0.0, 0.15)
            ),
            "building_count": max(0, int(pop_raw * 90 + rng.integers(-10, 15))),
            # Risk
            "flood_risk": flood_risk,
            "water_dist_m": clamp(flood_risk) * 600,
            "aqi_index": clamp(0.3 + (1 - pull) * 0.4 + noise() * 0.1),
            # Raw sub-scores (for quick client-side use)
            "raw_footfall": footfall,
            "raw_competition": competition,
            "raw_accessibility": accessibility,
            "raw_complementary": complementary,
            "raw_rent": rent_raw,
            "parking": parking,
        })

    df = pd.DataFrame(rows)

    coverage = {
        "population": 0.97,
        "transportation": 0.95,
        "pois": 0.89,
        "landuse": 0.93,
        "risk": 0.72,
    }
    meta = {
        "id": seed["id"],
        "name": seed["name"],
        "region": seed["region"],
        "center": seed["center"],
        "hex_count": len(cells),
        "resolution": RES,
        "blurb": seed["blurb"],
        "layers": [
            {"id": "population", "label": "Population & Demographics", "coverage": coverage["population"], "synthetic": True, "source": "Synthetic census proxy"},
            {"id": "transportation", "label": "Transportation", "coverage": coverage["transportation"], "synthetic": True, "source": "Synthetic road/transit graph"},
            {"id": "pois", "label": "Points of Interest", "coverage": coverage["pois"], "synthetic": True, "source": "Synthetic POI dataset"},
            {"id": "landuse", "label": "Land Use & Zoning", "coverage": coverage["landuse"], "synthetic": True, "source": "Synthetic zoning"},
            {"id": "risk", "label": "Environmental & Risk", "coverage": coverage["risk"], "synthetic": True, "source": "Synthetic flood/AQI"},
        ],
        "synthetic": True,
    }

    return df, meta


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "..", "app", "data")

    for seed in CITY_SEEDS:
        city_dir = os.path.join(data_dir, seed["id"])
        os.makedirs(city_dir, exist_ok=True)

        print(f"Building {seed['name']}...")
        df, meta = build_city(seed)

        # Write parquet
        parquet_path = os.path.join(city_dir, "hex_features.parquet")
        df.to_parquet(parquet_path, index=False)
        print(f"  → {len(df)} hexes → {parquet_path}")

        # Write meta
        meta_path = os.path.join(city_dir, "meta.json")
        with open(meta_path, "w") as f:
            json.dump(meta, f, indent=2)
        print(f"  → meta → {meta_path}")

    print("Done.")


if __name__ == "__main__":
    main()
