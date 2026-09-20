"""
sensitivity.py — Monte Carlo Weight Sensitivity & Robustness Analysis.
Computes rank stability and confidence intervals under weight perturbations.
"""

from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd

from app.services.scoring import ScoringConfig, score_city_dataset


def compute_monte_carlo_sensitivity(
    df: pd.DataFrame,
    config: ScoringConfig,
    n_simulations: int = 100,
    jitter_pct: float = 0.20,
    top_n: int = 15,
) -> dict[str, Any]:
    """
    Performs M=100 Monte Carlo runs with Gaussian weight jitter.
    Calculates rank variance, stability index, and robustness classification.
    """
    # 1. Baseline scoring
    base_scored, _ = score_city_dataset(df, config)
    base_sorted = base_scored.sort_values(by="score", ascending=False).reset_index(drop=True)
    base_sorted["base_rank"] = np.arange(1, len(base_sorted) + 1)

    top_candidates = base_sorted.head(top_n).copy()
    top_h3s = set(top_candidates["h3"].tolist())

    weight_keys = list(config.weights.keys())
    base_weights = np.array([float(config.weights[k]) for k in weight_keys])
    base_total = base_weights.sum() or 100.0

    # Store simulation ranks and scores
    sim_scores = {h: [] for h in top_h3s}
    sim_ranks = {h: [] for h in top_h3s}
    top_decile_threshold = max(1, int(len(df) * 0.10))

    for _ in range(n_simulations):
        # Generate jittered weights with Gaussian noise
        noise = np.random.normal(0, jitter_pct * base_weights)
        perturbed_w = np.maximum(1.0, base_weights + noise)
        perturbed_w = (perturbed_w / perturbed_w.sum()) * base_total

        sim_weights = {k: float(perturbed_w[i]) for i, k in enumerate(weight_keys)}

        sim_config = ScoringConfig(
            preset=config.preset,
            weights=sim_weights,
            decay=config.decay,
            competition=config.competition,
            constraints=config.constraints,
        )

        sim_scored, _ = score_city_dataset(df, sim_config)
        sim_scored["sim_rank"] = sim_scored["score"].rank(ascending=False, method="min")

        sim_dict = sim_scored.set_index("h3")[["score", "sim_rank"]].to_dict(orient="index")
        for h in top_h3s:
            if h in sim_dict:
                sim_scores[h].append(sim_dict[h]["score"])
                sim_ranks[h].append(sim_dict[h]["sim_rank"])

    results = []
    for _, row in top_candidates.iterrows():
        h = row["h3"]
        ranks = np.array(sim_ranks[h])
        scores = np.array(sim_scores[h])

        mean_rank = float(np.mean(ranks))
        std_rank = float(np.std(ranks))
        min_rank = int(np.min(ranks))
        max_rank = int(np.max(ranks))
        in_top_decile_pct = float(np.mean(ranks <= top_decile_threshold) * 100.0)

        # Stability Index (0 to 100)
        stability_idx = round(max(0.0, min(100.0, 100.0 - (std_rank / len(df) * 1000.0))), 1)

        if stability_idx >= 80.0:
            classification = "Highly Robust"
        elif stability_idx >= 60.0:
            classification = "Moderately Robust"
        else:
            classification = "Sensitive to Weights"

        results.append({
            "h3": h,
            "lat": round(float(row["lat"]), 6),
            "lng": round(float(row["lng"]), 6),
            "base_score": round(float(row["score"]), 1),
            "base_rank": int(row["base_rank"]),
            "mean_sim_score": round(float(np.mean(scores)), 1),
            "mean_sim_rank": round(mean_rank, 1),
            "rank_std_dev": round(std_rank, 2),
            "rank_range": [min_rank, max_rank],
            "in_top_10_pct_probability": round(in_top_decile_pct, 1),
            "stability_index": stability_idx,
            "classification": classification,
        })

    return {
        "n_simulations": n_simulations,
        "jitter_pct": jitter_pct,
        "total_hexes": len(df),
        "top_decile_cutoff_rank": top_decile_threshold,
        "candidates": results,
    }
