import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import osmnx as ox
import geopandas as gpd
import shapely.geometry

cache_dir = Path(__file__).parent.parent / "data" / "cache" / "osmnx"
print("Cached files in", cache_dir)
for f in cache_dir.glob("*.json"):
    print(f"  {f.name}: {f.stat().st_size / 1024:.1f} KB")

# Test loading features
ox.settings.use_cache = True
ox.settings.cache_folder = str(cache_dir)
ox.settings.log_console = False

# Center of Ahmedabad
center_lng, center_lat = 72.5714, 23.0225
radius_km = 17.5
import math
pts = []
for i in range(64):
    ang = 2 * math.pi * i / 64
    dx = (radius_km * math.cos(ang)) / (111.32 * math.cos(math.radians(center_lat)))
    dy = (radius_km * math.sin(ang)) / 110.57
    pts.append((center_lng + dx, center_lat + dy))
pts.append(pts[0])
boundary_poly = shapely.geometry.Polygon(pts)

print("\nTesting loading roads from cache...")
try:
    roads_gdf = ox.features_from_polygon(
        boundary_poly,
        tags={"highway": [
            "motorway", "motorway_link", "trunk", "trunk_link",
            "primary", "primary_link", "secondary", "secondary_link",
            "tertiary", "tertiary_link", "residential", "unclassified", "service",
        ]},
    )
    print(f"Successfully loaded {len(roads_gdf):,} roads from cache!")
except Exception as e:
    print("Roads load error:", e)

print("\nTesting loading POIs from cache...")
try:
    pois_gdf = ox.features_from_polygon(
        boundary_poly,
        tags={
            "amenity": True,
            "shop": True,
            "office": True,
            "leisure": True,
            "tourism": True,
            "man_made": ["mast", "tower"],
            "power": ["substation", "generator", "plant"],
        },
    )
    print(f"Successfully loaded {len(pois_gdf):,} POIs from cache!")
except Exception as e:
    print("POIs load error:", e)
