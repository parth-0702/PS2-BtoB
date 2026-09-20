"""
test_report_unit.py — Verify ReportLab PDF generation.
"""

import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.services.report import generate_pdf_report
from app.services.scoring import ScoringConfig, score_city_dataset
from app.routers.cities import _load_hexes, _load_meta


def test_pdf_report():
    print("Testing PDF report generation...")
    df = _load_hexes("ahmedabad")
    scored, summary = score_city_dataset(df, ScoringConfig())
    top_sites = scored.sort_values(by="score", ascending=False).head(10).to_dict(orient="records")
    meta = _load_meta("ahmedabad")

    ai_exp = {
        "summary": "This evaluation covers 1,392 hexagons across Ahmedabad. Top locations cluster around high-density commercial avenues.",
        "strengths": [
            "Dense pedestrian and customer base in Navrangpura and Vastrapur.",
            "High road graph connectivity and transit access.",
        ],
        "risks": [
            "Low-lying riverfront zones exhibit elevated monsoon flood susceptibility.",
        ],
        "recommendation": "Acquire leases in Top 5 decile zones along SG Highway and CG Road.",
    }

    pdf_bytes = generate_pdf_report(
        city_name="Ahmedabad",
        business_type="Specialty Cafe",
        score_summary=summary,
        top_sites=top_sites,
        ai_explanation=ai_exp,
        provenance_meta=meta,
    )

    print(f"Generated PDF report: {len(pdf_bytes):,} bytes")
    assert len(pdf_bytes) > 2000, "PDF must not be empty"
    assert pdf_bytes.startswith(b"%PDF-"), "Must be a valid PDF header"
    print("✅ PDF Report generation test PASSED!")


if __name__ == "__main__":
    test_pdf_report()
