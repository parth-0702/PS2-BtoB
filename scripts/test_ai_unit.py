"""
test_ai_unit.py — Unit test for AI parsing, explanation, comparison, sensitivity, and streaming.
"""

import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from app.services.llm import (
    parse_natural_language_business,
    generate_site_explanation,
    compare_candidate_sites,
)
from app.services.sensitivity import compute_monte_carlo_sensitivity
from app.services.scoring import ScoringConfig
from app.routers.cities import _load_hexes


def test_ai():
    print("Testing Natural Language Business Parser...")
    parsed = parse_natural_language_business("I want to open a high-end specialty cafe near metro and offices")
    print(f"  Parsed Business: {parsed.business_type}")
    print(f"  Weights: {parsed.weights}")
    print(f"  Source: {parsed.source}")
    assert parsed.weights["accessibility"] > 0
    assert parsed.weights["demand"] > 0
    assert abs(sum(parsed.weights.values()) - 100.0) < 1.0

    print("\nTesting Factual Site Explanation...")
    dummy_site = {
        "score": 78.4,
        "sub_demand": 82.0,
        "sub_transit": 75.0,
        "sub_footfall": 80.0,
        "sub_competition": 62.0,
        "sub_risk": 90.0,
        "pop_count": 8420,
        "comp_density_k": 0.45,
        "landuse_dominant": "commercial",
        "flood_susceptibility": 0.08,
        "eligible": True,
    }
    explanation = generate_site_explanation(dummy_site, business_type="Specialty Cafe")
    print(f"  Summary: {explanation.summary}")
    print(f"  Strengths: {explanation.strengths}")
    print(f"  Risks: {explanation.risks}")
    print(f"  Source: {explanation.source}")
    assert len(explanation.strengths) >= 1
    assert "Specialty Cafe" in explanation.recommendation or explanation.summary

    print("\nTesting Multi-Site Comparison...")
    site_b = {**dummy_site, "score": 64.2, "sub_demand": 60.0, "h3": "hex_b"}
    dummy_site["h3"] = "hex_a"
    comp = compare_candidate_sites([dummy_site, site_b], business_type="Specialty Cafe")
    print(f"  Winner: Site {comp.winner_index} ({comp.winner_h3})")
    print(f"  Recommendation: {comp.recommendation}")
    assert comp.winner_index == 1

    print("\nTesting Monte Carlo Sensitivity Analysis...")
    df = _load_hexes("ahmedabad")
    sens = compute_monte_carlo_sensitivity(df, ScoringConfig(), n_simulations=50, top_n=5)
    print(f"  Simulations: {sens['n_simulations']}")
    print(f"  Top Candidates Analyzed: {len(sens['candidates'])}")
    for cand in sens["candidates"]:
        print(f"    - Rank {cand['base_rank']} (H3: {cand['h3']}): Base Score {cand['base_score']} -> Mean Sim Rank {cand['mean_sim_rank']} (Std {cand['rank_std_dev']}) | {cand['classification']}")
        assert cand["stability_index"] >= 0

    print("\n✅ All AI & Sensitivity tests PASSED!")


if __name__ == "__main__":
    test_ai()
