import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import json
import math
import numpy as np
import pandas as pd
import shapely.geometry
import rasterio
from rasterio.mask import mask
from app.services import h3_compat

# Center of Ahmedabad
center_lng, center_lat = 72.5714, 23.0225
radius_km = 17.5

# Create geodesic circle / polygon in EPSG:4326
pts = []
for i in range(64):
    ang = 2 * math.pi * i / 64
    # Approximate degree offsets
    dx = (radius_km * math.cos(ang)) / (111.32 * math.cos(math.radians(center_lat)))
    dy = (radius_km * math.sin(ang)) / 110.57
    pts.append((center_lng + dx, center_lat + dy))
pts.append(pts[0])

poly = shapely.geometry.Polygon(pts)
geojson_poly = shapely.geometry.mapping(poly)

# Convert to H3 cells at res 8
cells = h3_compat.polygon_to_cells(geojson_poly, 8)
print(f"Generated {len(cells)} H3 res-8 cells for Ahmedabad (~{radius_km} km radius)")

# Read WorldPop raster and clip
raster_path = r"e:\PROJECTS\bites-to-build\ps2\data\raw\worldpop\ind_ppp_2020_constrained.tif"
with rasterio.open(raster_path) as src:
    out_image, out_transform = mask(src, [geojson_poly], crop=True)
    out_meta = src.meta.copy()
    out_meta.update({
        "driver": "GTiff",
        "height": out_image.shape[1],
        "width": out_image.shape[2],
        "transform": out_transform,
        "nodata": 0.0,
    })
    pop_arr = out_image[0]
    pop_arr[pop_arr < 0] = 0.0
    total_pop = float(pop_arr.sum())
    print(f"Total clipped population inside boundary: {total_pop:,.0f}")
