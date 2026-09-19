"""
ai.py — AI explanation service with Gemini API and template fallback.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
API_KEY = os.getenv("GEMINI_API_KEY", "")


def _template_explanation(site: dict[str, Any]) -> dict:
    score = site.get("score", 0)
    subs = {k: v for k, v in site.items() if k.startswith("sub_")}
    top = max(subs, key=subs.get, default="sub_demand") if subs else "sub_demand"
    top_label = top.replace("sub_", "").replace("_", " ").title()
    low = min(subs, key=subs.get, default="sub_risk") if subs else "sub_risk"
    low_label = low.replace("sub_", "").replace("_", " ").title()
    landuse = site.get("landuse_dominant", "mixed")
    return {
        "summary": f"This site scores {score:.0f}/100, ranking in the {'top' if score >= 70 else 'mid' if score >= 45 else 'lower'} tier of the city.",
        "strengths": [
            f"Strong {top_label} score ({subs.get(top, 0):.0f}/100) — this is the primary driver.",
            f"Land use ({landuse}) is {'well-suited' if score >= 60 else 'acceptable'} for this business type.",
        ],
        "risks": [
            f"Lower {low_label} ({subs.get(low, 0):.0f}/100) — consider this in your decision.",
            "Data is synthetic; validate with on-ground scouting.",
        ],
        "suggestion": (
            "Good candidate — worth visiting in person."
            if score >= 65
            else "Consider higher-scoring alternatives before committing."
        ),
        "source": "template",
    }


def _gemini_explanation(site: dict[str, Any], business: str) -> dict:
    prompt = f"""
You are a business location consultant. A site-readiness model scored this location:
Business type: {business}
Score: {site.get('score', 0):.0f}/100
Sub-scores (0-100): {', '.join(f"{k.replace('sub_','')}={v:.0f}" for k, v in site.items() if k.startswith('sub_'))}
Land use: {site.get('landuse_dominant', 'unknown')}
Eligible: {site.get('eligible', True)}
Blocked by: {site.get('blocked_by', '')}

Return ONLY valid JSON with keys: summary (string), strengths (array of 2-3 strings), risks (array of 2 strings), suggestion (string).
Do NOT add any text outside the JSON.
"""
    try:
        resp = httpx.post(
            f"{GEMINI_URL}?key={API_KEY}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=10.0,
        )
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        # Strip markdown fences if present
        text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        import json
        data = json.loads(text)
        data["source"] = "gemini"
        return data
    except Exception:
        return {}


def explain_site(site: dict[str, Any], business: str = "retail store") -> dict:
    if API_KEY:
        result = _gemini_explanation(site, business)
        if result:
            return result
    return _template_explanation(site)


def compare_sites(sites: list[dict[str, Any]], business: str = "retail store") -> dict:
    if not sites:
        return {"recommendation": "No sites provided.", "source": "template"}
    best = max(sites, key=lambda s: s.get("score", 0))
    if API_KEY:
        prompt = f"""
Compare these {len(sites)} candidate sites for a {business}:
{chr(10).join(f"Site {i+1}: score={s.get('score',0):.0f}, " + ", ".join(f"{k.replace('sub_','')}={v:.0f}" for k,v in s.items() if k.startswith('sub_')) for i, s in enumerate(sites))}

Return ONLY valid JSON: {{ "recommendation": "string", "reason": "string", "winner": 1-based index, "source": "gemini" }}
"""
        try:
            resp = httpx.post(
                f"{GEMINI_URL}?key={API_KEY}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=10.0,
            )
            resp.raise_for_status()
            text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
            text = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            import json
            return json.loads(text)
        except Exception:
            pass

    winner_idx = sites.index(best) + 1
    return {
        "recommendation": f"Site {winner_idx} is the strongest candidate with a score of {best.get('score', 0):.0f}/100.",
        "reason": f"It leads on {max((k for k in best if k.startswith('sub_')), key=lambda k: best.get(k, 0), default='overall').replace('sub_','').replace('_',' ').title()}.",
        "winner": winner_idx,
        "source": "template",
    }
