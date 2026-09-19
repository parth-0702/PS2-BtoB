"""
ai.py router — AI explanation and comparison endpoints.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.ai import explain_site, compare_sites

router = APIRouter(prefix="/ai", tags=["ai"])


class ExplainRequest(BaseModel):
    site: dict
    business: str = "retail store"


class CompareRequest(BaseModel):
    sites: list[dict]
    business: str = "retail store"


@router.post("/explain")
def explain(req: ExplainRequest):
    return explain_site(req.site, req.business)


@router.post("/compare")
def compare(req: CompareRequest):
    return compare_sites(req.sites, req.business)
