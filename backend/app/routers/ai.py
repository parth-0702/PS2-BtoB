"""
ai.py router — AI explanation, natural language parsing, site comparison, and sensitivity endpoints.
"""

from __future__ import annotations

from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.routers.cities import _load_hexes
from app.services.llm import (
    parse_natural_language_business,
    generate_site_explanation,
    compare_candidate_sites,
    ParsedBusinessConfig,
    SiteExplanation,
    SiteComparison,
)
from app.services.scoring import ScoringConfig
from app.services.sensitivity import compute_monte_carlo_sensitivity

router = APIRouter(prefix="/ai", tags=["ai"])


class ParseBusinessRequest(BaseModel):
    description: str


class ExplainRequest(BaseModel):
    site: dict[str, Any]
    business_type: str = "retail business"


class CompareRequest(BaseModel):
    sites: list[dict[str, Any]]
    business_type: str = "retail business"


class SensitivityRequest(BaseModel):
    city_id: str
    config: ScoringConfig = ScoringConfig()
    n_simulations: int = Field(default=100, ge=10, le=500)
    jitter_pct: float = Field(default=0.20, ge=0.05, le=0.50)
    top_n: int = Field(default=15, ge=3, le=50)


@router.post("/parse-business", response_model=ParsedBusinessConfig)
def parse_business(req: ParseBusinessRequest):
    return parse_natural_language_business(req.description)


@router.post("/explain", response_model=SiteExplanation)
def explain(req: ExplainRequest):
    return generate_site_explanation(req.site, req.business_type)


@router.post("/compare", response_model=SiteComparison)
def compare(req: CompareRequest):
    return compare_candidate_sites(req.sites, req.business_type)


@router.post("/sensitivity")
def sensitivity(req: SensitivityRequest):
    try:
        df = _load_hexes(req.city_id)
        res = compute_monte_carlo_sensitivity(
            df=df,
            config=req.config,
            n_simulations=req.n_simulations,
            jitter_pct=req.jitter_pct,
            top_n=req.top_n,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
