"""
score.py — City scoring and Click-Anywhere Point Scoring Endpoints.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.scoring import ScoringConfig, score_city_dataset, score_point_location
from app.routers.cities import _load_hexes, DATA_DIR

router = APIRouter(prefix="/score", tags=["score"])


class ScoreRequest(BaseModel):
    city_id: str
    config: ScoringConfig


class PointScoreRequest(BaseModel):
    city_id: str
    lat: float
    lng: float
    config: ScoringConfig


@router.post("")
def score(req: ScoreRequest):
    df = _load_hexes(req.city_id)
    result, summary = score_city_dataset(df, req.config)

    eligible = result[result["eligible"]]
    sub_cols = [c for c in result.columns if c.startswith("sub_")]
    contrib_cols = [c for c in result.columns if c.startswith("contrib_")]

    top3 = eligible.nlargest(3, "score")[
        ["h3", "lat", "lng", "score", "comp_density_k", "saturation_index"] + sub_cols + contrib_cols
    ].to_dict(orient="records")

    cols = [
        "h3", "lat", "lng", "score", "eligible", "blocked_by",
        "comp_density_k", "saturation_index",
    ] + sub_cols + contrib_cols

    hexes = result[cols].to_dict(orient="records")

    return {
        "summary": summary,
        "top3": top3,
        "hexes": hexes,
    }


@router.post("/point")
def score_point(req: PointScoreRequest):
    df = _load_hexes(req.city_id)
    try:
        point_result = score_point_location(
            city_id=req.city_id,
            lat=req.lat,
            lng=req.lng,
            cfg=req.config,
            df=df,
            data_dir=DATA_DIR,
        )
        return point_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Point scoring failed: {str(e)}")
