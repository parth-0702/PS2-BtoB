import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import osmnx as ox
import shapely.geometry

# Configure OSMnx settings for caching and logging
ox.settings.use_cache = True
ox.settings.log_console = True
ox.settings.cache_folder = str(Path(__file__).parent.parent / "data" / "cache" / "osmnx")

# Small test box in Ahmedabad (Ashram Road / Riverfront area)
test_box = shapely.geometry.box(72.56, 23.01, 72.59, 23.04)

print("Fetching test roads...")
roads_gdf = ox.features_from_polygon(test_box, tags={"highway": ["primary", "secondary", "tertiary", "residential", "trunk"]})
print(f"Found {len(roads_gdf)} road segments in test box")

print("Fetching test POIs...")
pois_gdf = ox.features_from_polygon(test_box, tags={"amenity": True, "shop": True})
print(f"Found {len(pois_gdf)} POIs in test box")
