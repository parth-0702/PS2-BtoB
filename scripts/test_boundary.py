import requests
import json
import shapely.geometry
from shapely.ops import transform
import pyproj

# Query overpass for Ahmedabad boundary relations
q = """
[out:json][timeout:30];
(
  relation["admin_level"="8"]["name:en"="Ahmedabad"];
  relation["name"="Ahmedabad City Taluka"];
  relation["boundary"="administrative"]["name"="Ahmedabad"];
);
out ids tags;
"""
try:
    r = requests.post("https://overpass-api.de/api/interpreter", data={"data": q}, timeout=30)
    print("Overpass status:", r.status_code)
    print(json.dumps(r.json(), indent=2))
except Exception as e:
    print("Error:", e)
