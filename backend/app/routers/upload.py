"""
upload.py — Layer ingestion endpoint (PS-2 compliant).
Supports GeoJSON, Shapefile (.zip), GeoTIFF, and WKT uploads.
"""

from __future__ import annotations

import io
import json
import os
import tempfile
import zipfile
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
import geopandas as gpd
import rasterio
from shapely import wkt
from shapely.geometry import shape, box

_ROOT = Path(__file__).resolve().parents[2]
# Data directory is at project root, not backend/
DATA_DIR = _ROOT.parent / "data" if (_ROOT.parent / "data").exists() else _ROOT / "data"

router = APIRouter(prefix="/layers", tags=["layers"])


def _city_layers_dir(city_id: str) -> Path:
    """Get the layers directory for a city, create if not exists."""
    d = DATA_DIR / city_id / "layers"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _validate_city_exists(city_id: str) -> None:
    """Validate that the city directory exists."""
    if not (DATA_DIR / city_id).exists():
        raise HTTPException(status_code=404, detail=f"City '{city_id}' not found")


@router.post("/upload")
async def upload_layer(
    city_id: str = Form(...),
    layer_name: str = Form(...),
    layer_type: str = Form(...),  # "geojson", "shapefile", "geotiff", "wkt"
    file: UploadFile = File(...),
    overwrite: bool = Form(False),
) -> dict[str, Any]:
    """
    Upload a geospatial layer for a city.

    Supported formats:
    - GeoJSON (.geojson, .json)
    - Shapefile (.zip containing .shp, .shx, .dbf, .prj)
    - GeoTIFF (.tif, .tiff)
    - WKT (.wkt, .txt)
    """
    _validate_city_exists(city_id)

    layers_dir = _city_layers_dir(city_id)
    safe_name = "".join(c for c in layer_name if c.isalnum() or c in ("-", "_")).rstrip()

    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid layer name")

    target_path = layers_dir / f"{safe_name}.geojson"
    if target_path.exists() and not overwrite:
        raise HTTPException(status_code=409, detail=f"Layer '{safe_name}' already exists. Use overwrite=true to replace.")

    content = await file.read()

    try:
        if layer_type == "geojson":
            _process_geojson(content, target_path)
        elif layer_type == "shapefile":
            _process_shapefile(content, layers_dir, safe_name)
        elif layer_type == "geotiff":
            _process_geotiff(content, layers_dir, safe_name)
        elif layer_type == "wkt":
            _process_wkt(content, target_path)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported layer_type: {layer_type}. Use: geojson, shapefile, geotiff, wkt")

    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to process layer: {str(e)}")

    # Return layer info
    return {
        "city_id": city_id,
        "layer_name": safe_name,
        "layer_type": layer_type,
        "file_path": str(target_path.relative_to(DATA_DIR)),
        "message": "Layer uploaded and registered successfully",
    }


def _process_geojson(content: bytes, target_path: Path) -> None:
    """Process and validate GeoJSON content."""
    try:
        data = json.loads(content.decode("utf-8"))
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {e}")

    if data.get("type") != "FeatureCollection":
        raise ValueError("GeoJSON must be a FeatureCollection")

    if "features" not in data:
        raise ValueError("GeoJSON missing 'features' array")

    # Validate with geopandas
    gdf = gpd.GeoDataFrame.from_features(data["features"])
    if gdf.crs is None:
        gdf.set_crs(epsg=4326, inplace=True)
    elif gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    # Write validated GeoJSON
    gdf.to_file(target_path, driver="GeoJSON")


def _process_shapefile(content: bytes, layers_dir: Path, safe_name: str) -> None:
    """Process Shapefile from ZIP archive."""
    with tempfile.TemporaryDirectory() as tmpdir:
        zip_path = Path(tmpdir) / "upload.zip"
        zip_path.write_bytes(content)

        try:
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(tmpdir)
        except zipfile.BadZipFile:
            raise ValueError("Invalid ZIP file")

        # Find .shp file
        shp_files = list(Path(tmpdir).rglob("*.shp"))
        if not shp_files:
            raise ValueError("No .shp file found in ZIP archive")

        shp_path = shp_files[0]
        gdf = gpd.read_file(shp_path)

        if gdf.crs is None:
            gdf.set_crs(epsg=4326, inplace=True)
        elif gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)

        target_path = layers_dir / f"{safe_name}.geojson"
        gdf.to_file(target_path, driver="GeoJSON")


def _process_geotiff(content: bytes, layers_dir: Path, safe_name: str) -> None:
    """Process GeoTIFF - store as-is and create boundary GeoJSON for reference."""
    tif_path = layers_dir / f"{safe_name}.tif"
    tif_path.write_bytes(content)

    # Validate with rasterio and extract bounds
    with rasterio.open(io.BytesIO(content)) as src:
        if src.crs is None:
            raise ValueError("GeoTIFF missing CRS")
        bounds = src.bounds
        crs = src.crs.to_epsg()

    # Create a boundary GeoJSON for the raster
    from shapely.geometry import box
    bounds_poly = box(bounds.left, bounds.bottom, bounds.right, bounds.top)
    gdf = gpd.GeoDataFrame([{"layer_name": safe_name, "crs": f"EPSG:{crs}"}], geometry=[bounds_poly], crs=f"EPSG:{crs}")
    if gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    boundary_path = layers_dir / f"{safe_name}.geojson"
    gdf.to_file(boundary_path, driver="GeoJSON")


def _process_wkt(content: bytes, target_path: Path) -> None:
    """Process WKT content."""
    text = content.decode("utf-8").strip()

    try:
        geom = wkt.loads(text)
    except Exception as e:
        raise ValueError(f"Invalid WKT: {e}")

    gdf = gpd.GeoDataFrame(geometry=[geom], crs="EPSG:4326")
    gdf.to_file(target_path, driver="GeoJSON")


@router.get("/{city_id}/list")
def list_uploaded_layers(city_id: str) -> dict[str, Any]:
    """List all uploaded layers for a city."""
    _validate_city_exists(city_id)
    layers_dir = _city_layers_dir(city_id)

    layers = []
    for f in layers_dir.glob("*.geojson"):
        try:
            gdf = gpd.read_file(f)
            layers.append({
                "name": f.stem,
                "path": str(f.relative_to(DATA_DIR)),
                "feature_count": len(gdf),
                "geometry_types": gdf.geom_type.unique().tolist(),
                "crs": str(gdf.crs) if gdf.crs else "EPSG:4326",
                "bounds": gdf.total_bounds.tolist() if len(gdf) > 0 else None,
            })
        except Exception:
            layers.append({
                "name": f.stem,
                "path": str(f.relative_to(DATA_DIR)),
                "error": "Could not read layer metadata",
            })

    return {"city_id": city_id, "layers": layers}


@router.delete("/{city_id}/{layer_name}")
def delete_layer(city_id: str, layer_name: str) -> dict[str, Any]:
    """Delete an uploaded layer."""
    _validate_city_exists(city_id)
    layers_dir = _city_layers_dir(city_id)

    safe_name = "".join(c for c in layer_name if c.isalnum() or c in ("-", "_")).rstrip()
    target_path = layers_dir / f"{safe_name}.geojson"
    tif_path = layers_dir / f"{safe_name}.tif"

    deleted = []
    if target_path.exists():
        target_path.unlink()
        deleted.append(str(target_path.relative_to(DATA_DIR)))
    if tif_path.exists():
        tif_path.unlink()
        deleted.append(str(tif_path.relative_to(DATA_DIR)))

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Layer '{safe_name}' not found")

    return {"city_id": city_id, "deleted": deleted}