import requests
import time

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

q = """[out:json][timeout:15];
(
  node["amenity"="pharmacy"](23.01,72.56,23.03,72.58);
);
out count;"""

for ep in ENDPOINTS:
    t0 = time.time()
    try:
        r = requests.post(ep, data={"data": q}, headers={"User-Agent": "SiteScope-GIS/1.0"}, timeout=10)
        dt = time.time() - t0
        print(f"{ep} -> Status: {r.status_code}, Time: {dt:.2f}s")
    except Exception as e:
        print(f"{ep} -> Failed: {e}")
