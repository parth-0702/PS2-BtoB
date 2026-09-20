"""
cities.py — City listing and hex data endpoints.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/cities", tags=["cities"])

# Resolve data directory from repo root or backend parent
_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = _ROOT / "data" if (_ROOT / "data").exists() else Path(__file__).resolve().parents[2] / "data"


@lru_cache(maxsize=16)
def _load_meta(city_id: str) -> dict:
    path = DATA_DIR / city_id / "meta.json"
    if not path.exists():
        raise HTTPException(404, f"City '{city_id}' not found")
    with open(path) as f:
        return json.load(f)


@lru_cache(maxsize=8)
def _load_hexes(city_id: str) -> pd.DataFrame:
    path = DATA_DIR / city_id / "hex_features.parquet"
    if not path.exists():
        raise HTTPException(404, f"Hex data for '{city_id}' not found")
    return pd.read_parquet(path)


def _city_ids() -> list[str]:
    if not DATA_DIR.exists():
        return []
    return [d.name for d in DATA_DIR.iterdir() if d.is_dir() and (d / "meta.json").exists()]


@router.get("")
def list_cities():
    return [_load_meta(cid) for cid in _city_ids()]


@router.get("/{city_id}/meta")
def get_meta(city_id: str):
    return _load_meta(city_id)


@router.get("/{city_id}/hexes")
def get_hexes(city_id: str):
    df = _load_hexes(city_id)
    return df.to_dict(orient="records")


@router.get("/{city_id}/layers")
def list_city_layers(city_id: str):
    layers_dir = DATA_DIR / city_id / "layers"
    if not layers_dir.exists():
        return []
    return [f.stem for f in layers_dir.glob("*.geojson")]


@router.get("/{city_id}/layers/{layer_name}")
def get_city_layer(city_id: str, layer_name: str):
    file_path = DATA_DIR / city_id / "layers" / f"{layer_name}.geojson"
    if not file_path.exists():
        raise HTTPException(404, f"Layer '{layer_name}' not found for city '{city_id}'")
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)
