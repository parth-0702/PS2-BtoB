"""
score.py — Scoring endpoint.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.scoring import ScoringConfig, score_city
from app.routers.cities import _load_hexes

router = APIRouter(prefix="/score", tags=["score"])


class ScoreRequest(BaseModel):
    city_id: str
    config: ScoringConfig


@router.post("")
def score(req: ScoreRequest):
    df = _load_hexes(req.city_id)
    result = score_city(df, req.config)

    eligible = result[result["eligible"]]
    top3 = eligible.nlargest(3, "score")[["h3", "lat", "lng", "score"] + [c for c in result.columns if c.startswith("sub_")]].to_dict(orient="records")

    summary = {
        "total_hexes": len(result),
        "eligible_hexes": int(result["eligible"].sum()),
        "avg_score": round(float(result["score"].mean()), 1),
        "high_potential": int(result["high_potential"].sum()),
        "underserved": int(result["underserved"].sum()),
        "hot_spots": int((result["gi_z"] > 1.65).sum()),
        "cold_spots": int((result["gi_z"] < -1.65).sum()),
    }

    # Return only essential columns to keep payload small
    cols = ["h3", "lat", "lng", "score", "eligible", "blocked_by", "gi_z", "hotspot",
            "underserved", "high_potential"] + [c for c in result.columns if c.startswith("sub_")]
    hexes = result[cols].to_dict(orient="records")

    return {"summary": summary, "top3": top3, "hexes": hexes}
