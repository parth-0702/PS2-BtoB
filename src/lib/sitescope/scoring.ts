import { gridDisk } from "h3-js";
import type { CityData, HexCell, LayerId, ScoringConfig } from "./types";

export interface ScoredHex {
  h3: string;
  center: [number, number];
  boundary: [number, number][];
  score: number; // 0..1
  score100: number; // 0..100 integer
  eligible: boolean;
  blockedBy: string[];
  parts: { layer: string; label: string; weight: number; value: number; contribution: number }[];
  gi: number; // Gi* z-score
  gi_z: number;
  underserved: boolean;
  underservedScore: number;
  robustness: "high" | "medium" | "low";
  raw: HexCell;
  subscores: {
    demand: number;
    accessibility: number;
    complementary: number;
    competition: number;
    landuse: number;
    risk: number;
    [key: string]: number;
  };
  footfall: number;
  population: number;
  accessibility: number;
  complementary: number;
  competition: number;
  landuse: number;
  rent: number;
  floodRisk: number;
}

const LABELS: Record<string, string> = {
  population: "Demand (Population)",
  demand: "Demand (Population)",
  footfall: "Footfall",
  accessibility: "Accessibility (Transport)",
  complementary: "Complementary POIs",
  competition: "Competition",
  rent: "Rent / Budget",
  landuse: "Land Suitability",
  risk: "Risk (Flood & Env)",
};

function constraintCheck(h: HexCell, config: ScoringConfig, rentMedian: number): string[] {
  const blocked: string[] = [];
  const constraints = config?.constraints || [];

  for (const c of constraints) {
    if (c === "max_rent" && h.rent > rentMedian) blocked.push("Rent above the affordable half");
    if (c === "needs_parking" && h.parking < 0.35) blocked.push("Little parking");
    if (c === "ground_floor_commercial" && !(h.landuse === "commercial" || h.landuse === "mixed"))
      blocked.push("Not commercial land");
    if (c === "no_flood" && h.floodRisk > 0.65) blocked.push("Flood-prone");
    if (c === "no_industrial" && h.landuse === "industrial") blocked.push("Industrial zone");
    if (c === "high_visibility" && h.footfall < 0.45) blocked.push("Low visibility");
  }

  if (config?.landUseTable && config.landUseTable[h.landuse] === 0) {
    blocked.push("Land use excluded");
  }

  return blocked;
}

export function scoreCity(data: CityData, config: any): ScoredHex[] {
  if (!data || !data.hexes || data.hexes.length === 0) return [];

  const rents = data.hexes.map((h) => h.rent || 0.5).sort((a, b) => a - b);
  const rentMedian = rents[Math.floor(rents.length / 2)] ?? 0.5;

  const decayD0 = typeof config?.decayD0 === "number" ? config.decayD0 : (config?.decay?.d0_km ? config.decay.d0_km * 1000 : 1000);
  const decayFactor = Math.min(1, Math.max(0.1, decayD0 / 4000));

  // Normalize weight inputs
  const rawWeights = config?.weights || {};
  const wDemand = (rawWeights.demand ?? rawWeights.population ?? 25) / 100;
  const wAccess = (rawWeights.accessibility ?? 20) / 100;
  const wComp = (rawWeights.competition ?? 20) / 100;
  const wLand = (rawWeights.landuse ?? rawWeights.complementary ?? 15) / 100;
  const wRisk = (rawWeights.risk ?? rawWeights.rent ?? 10) / 100;

  const totalW = (wDemand + wAccess + wComp + wLand + wRisk) || 1;

  const compMode = config?.competition?.mode || config?.competitionMode || "penalise";

  const base = data.hexes.map((h) => {
    const pop = Number.isFinite(h.population) ? h.population : 0.5;
    const foot = Number.isFinite(h.footfall) ? h.footfall : 0.5;
    const access = Number.isFinite(h.accessibility) ? h.accessibility : 0.5;
    const comp = Number.isFinite(h.competition) ? h.competition : 0.4;
    const flood = Number.isFinite(h.floodRisk) ? h.floodRisk : 0.2;
    const landVal = h.landuse === "commercial" ? 0.95 : h.landuse === "mixed" ? 0.85 : h.landuse === "residential" ? 0.6 : 0.3;

    // Smoothed demand
    const demandVal = pop * (1 - decayFactor) + ((pop + foot) / 2) * decayFactor;
    const accessVal = access;
    const compVal = compMode === "cluster" || compMode === "cluster_bonus" ? comp : (1 - comp);
    const riskVal = 1 - flood;

    const parts = [
      { layer: "demand", label: "Demand (Population)", weight: wDemand / totalW, value: demandVal, contribution: (wDemand / totalW) * demandVal },
      { layer: "accessibility", label: "Accessibility", weight: wAccess / totalW, value: accessVal, contribution: (wAccess / totalW) * accessVal },
      { layer: "competition", label: "Competition", weight: wComp / totalW, value: compVal, contribution: (wComp / totalW) * compVal },
      { layer: "landuse", label: "Land Suitability", weight: wLand / totalW, value: landVal, contribution: (wLand / totalW) * landVal },
      { layer: "risk", label: "Risk Factor", weight: wRisk / totalW, value: riskVal, contribution: (wRisk / totalW) * riskVal },
    ];

    let score = parts.reduce((s, p) => s + (Number.isFinite(p.contribution) ? p.contribution : 0), 0);
    score = Math.max(0.05, Math.min(0.98, score));

    const blockedBy = constraintCheck(h, config, rentMedian);
    const subscores = {
      demand: Math.round(demandVal * 100),
      accessibility: Math.round(accessVal * 100),
      complementary: Math.round((h.complementary ?? 0.5) * 100),
      competition: Math.round(compVal * 100),
      landuse: Math.round(landVal * 100),
      risk: Math.round(riskVal * 100),
    };

    return { hex: h, parts, score, blockedBy, subscores, demandVal, accessVal, compVal, landVal, riskVal };
  });

  const scoreByH3 = new Map(base.map((b) => [b.hex.h3, b.score]));
  const allScores = base.map((b) => b.score);
  const mean = allScores.reduce((s, v) => s + v, 0) / (allScores.length || 1);
  const sd = Math.sqrt(allScores.reduce((s, v) => s + (v - mean) ** 2, 0) / (allScores.length || 1)) || 0.1;

  return base.map((b) => {
    let ring: string[] = [];
    try {
      ring = gridDisk(b.hex.h3, 2);
    } catch {
      ring = [b.hex.h3];
    }
    const vals = ring.map((c) => scoreByH3.get(c)).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
    const localMean = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : b.score;
    const gi = ((localMean - mean) / (sd / Math.sqrt(Math.max(1, vals.length)))) * 0.6;
    const spread = Math.sqrt(vals.reduce((s, v) => s + (v - localMean) ** 2, 0) / Math.max(1, vals.length));
    const robustness: ScoredHex["robustness"] = spread < 0.05 ? "high" : spread < 0.1 ? "medium" : "low";

    const demand = ((b.hex.population || 0.5) + (b.hex.footfall || 0.5)) / 2;
    const isUnderserved = demand > 0.55 && (b.hex.competition || 0) < 0.45;
    const underservedScore = Math.max(0, demand - (b.hex.competition || 0));

    const finalScore = Number.isFinite(b.score) ? b.score : 0.65;
    const score100 = Math.round(finalScore * 100);

    return {
      h3: b.hex.h3,
      center: b.hex.center,
      boundary: b.hex.boundary,
      score: finalScore,
      score100,
      eligible: b.blockedBy.length === 0,
      blockedBy: b.blockedBy,
      parts: b.parts,
      gi,
      gi_z: gi,
      underserved: isUnderserved,
      underservedScore,
      robustness,
      raw: b.hex,
      subscores: b.subscores,
      footfall: b.hex.footfall ?? 0.5,
      population: b.hex.population ?? 0.5,
      accessibility: b.hex.accessibility ?? 0.5,
      complementary: b.hex.complementary ?? 0.5,
      competition: b.hex.competition ?? 0.4,
      landuse: b.landVal,
      rent: b.hex.rent ?? 0.5,
      floodRisk: b.hex.floodRisk ?? 0.2,
    };
  });
}

export function topSites(scored: ScoredHex[], n = 5) {
  if (!scored || scored.length === 0) return [];
  return [...scored]
    .sort((a, b) => b.score - a.score)
    .slice(0, n);
}

export function distanceKm(a: [number, number], b: [number, number]) {
  const dx = (a[0] - b[0]) * 111 * Math.cos((a[1] * Math.PI) / 180);
  const dy = (a[1] - b[1]) * 111;
  return Math.sqrt(dx * dx + dy * dy);
}

