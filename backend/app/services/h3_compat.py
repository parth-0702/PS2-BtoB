"""
h3_compat.py — Universal compatibility layer for H3 v3 and v4 APIs.
"""

from __future__ import annotations

from typing import Any
import h3


def latlng_to_cell(lat: float, lng: float, res: int) -> str:
    """Converts lat/lng to H3 index string (supports v3 and v4)."""
    if hasattr(h3, "latlng_to_cell"):
        return h3.latlng_to_cell(lat, lng, res)
    return h3.geo_to_h3(lat, lng, res)


def cell_to_latlng(cell: str) -> tuple[float, float]:
    """Returns (lat, lng) tuple from H3 cell string."""
    if hasattr(h3, "cell_to_latlng"):
        return h3.cell_to_latlng(cell)
    return h3.h3_to_geo(cell)


def grid_disk(cell: str, k: int) -> list[str]:
    """Returns list of H3 cells in k-ring disk."""
    if hasattr(h3, "grid_disk"):
        return list(h3.grid_disk(cell, k))
    return list(h3.k_ring(cell, k))


def cell_to_boundary(cell: str, geo_json: bool = True) -> list[tuple[float, float]]:
    """
    Returns polygon coordinates for H3 cell.
    If geo_json=True, returns [[lng, lat], ...] coordinates.
    """
    if hasattr(h3, "cell_to_boundary"):
        coords = h3.cell_to_boundary(cell)
        # In v4, returns tuple of (lat, lng) pairs
        if geo_json:
            return [[c[1], c[0]] for c in coords]
        return list(coords)
    else:
        coords = h3.h3_to_geo_boundary(cell, geo_json=geo_json)
        return list(coords)


def polygon_to_cells(poly_or_geojson: Any, res: int) -> list[str]:
    """
    Fills a polygon (Shapely Polygon, GeoJSON dict, or coordinate list) with H3 cells.
    """
    if hasattr(h3, "LatLngPoly"):
        # H3 v4
        import shapely.geometry
        if isinstance(poly_or_geojson, shapely.geometry.Polygon):
            exterior = [(y, x) for x, y in poly_or_geojson.exterior.coords]
            interiors = [[(y, x) for x, y in ring.coords] for ring in poly_or_geojson.interiors]
            poly = h3.LatLngPoly(exterior, *interiors)
            return list(h3.polygon_to_cells(poly, res))
        elif isinstance(poly_or_geojson, shapely.geometry.MultiPolygon):
            cells = set()
            for geom in poly_or_geojson.geoms:
                exterior = [(y, x) for x, y in geom.exterior.coords]
                interiors = [[(y, x) for x, y in ring.coords] for ring in geom.interiors]
                poly = h3.LatLngPoly(exterior, *interiors)
                cells.update(h3.polygon_to_cells(poly, res))
            return list(cells)
        elif isinstance(poly_or_geojson, dict):
            geom_type = poly_or_geojson.get("type", "Polygon")
            coords = poly_or_geojson.get("coordinates", [])
            if geom_type == "Polygon":
                exterior = [(lat, lng) for lng, lat in coords[0]]
                interiors = [[(lat, lng) for lng, lat in ring] for ring in coords[1:]]
                poly = h3.LatLngPoly(exterior, *interiors)
                return list(h3.polygon_to_cells(poly, res))
            elif geom_type == "MultiPolygon":
                cells = set()
                for poly_coords in coords:
                    exterior = [(lat, lng) for lng, lat in poly_coords[0]]
                    interiors = [[(lat, lng) for lng, lat in ring] for ring in poly_coords[1:]]
                    poly = h3.LatLngPoly(exterior, *interiors)
                    cells.update(h3.polygon_to_cells(poly, res))
                return list(cells)
            else:
                raise ValueError(f"Unsupported geometry type: {geom_type}")
        else:
            raise ValueError(f"Unrecognized polygon type: {type(poly_or_geojson)}")
    else:
        # H3 v3
        import shapely.geometry
        if isinstance(poly_or_geojson, (shapely.geometry.Polygon, shapely.geometry.MultiPolygon)):
            geojson = shapely.geometry.mapping(poly_or_geojson)
            return list(h3.polyfill(geojson, res, geo_json_conformant=True))
        return list(h3.polyfill(poly_or_geojson, res, geo_json_conformant=True))
