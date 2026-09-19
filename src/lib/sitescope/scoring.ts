import { gridDisk } from "h3-js";
import type { CityData, HexCell, ScoringConfig } from "./types";

export interface ScoredHex {
  h3: string; center: [number, number]; boundary: [number, number][];
  score: number; score100: number; eligible: boolean; blockedBy: string[];
  parts: { layer: string; label: string; weight: number; value: number; contribution: number }[];
  gi: number; gi_z: number; underserved: boolean; underservedScore: number;
  robustness: "high" | "medium" | "low"; raw: HexCell;
  subscores: { demand: number; accessibility: number; complementary: number; competition: number; landuse: number; risk: number; [key: string]: number };
  footfall: number; population: number; accessibility: number; complementary: number;
  competition: number; landuse: number; rent: number; floodRisk: number;
}
export const FACTORS: Record<string, string> = {
  population: "Population", demand: "Population", footfall: "Foot traffic", accessibility: "Accessibility",
  complementary: "Nearby amenities", competition: "Competition", rent: "Affordability", landuse: "Land suitability", risk: "Environmental safety",
};
const clamp = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
export function distanceKm(a: [number, number], b: [number, number]) {
  const rad = Math.PI / 180;
  const v = Math.sin((b[1] - a[1]) * rad / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, v)));
}
export function scoreCity(data: CityData, config: ScoringConfig): ScoredHex[] {
  if (!data.hexes.length) return [];
  const rents = data.hexes.map(h => h.rent).sort((a,b) => a-b);
  const median = rents[Math.floor(rents.length / 2)] ?? 0.5;
  const weights = Object.entries(config.weights).filter(([k,v]) => k in FACTORS && Number.isFinite(v) && v > 0);
  const total = weights.reduce((s,[,v]) => s+v,0) || 1;
  const radius = Math.max(0.1, config.competitionRadius / 1000);
  const decay = Math.max(0.1, config.decayD0 / 1000);
  const cells = data.hexes.map(h => {
    const pressure = data.competitors.reduce((sum,p) => {
      const d = distanceKm(h.center,p.lngLat);
      return sum + (d <= radius ? Math.exp(-d / decay) : 0);
    },0);
    const density = 1 - Math.exp(-pressure / 3);
    const competition = config.competitionMode === "neutral" ? 0.5 : config.competitionMode === "cluster" ? density : 1-density;
    const values: Record<string,number> = {
      population: clamp(h.population), demand: clamp(h.population), footfall: clamp(h.footfall),
      accessibility: clamp(h.accessibility), complementary: clamp(h.complementary), competition,
      rent: 1-clamp(h.rent), landuse: clamp(config.landUseTable[h.landuse]), risk: 1-clamp(h.floodRisk),
    };
    const blockedBy: string[] = [];
    for (const c of config.constraints) {
      if (c === "max_rent" && h.rent > median) blockedBy.push("Rent exceeds the city median");
      if (c === "needs_parking" && h.parking < 0.35) blockedBy.push("Insufficient parking");
      if (c === "ground_floor_commercial" && !["commercial","mixed"].includes(h.landuse)) blockedBy.push("Commercial or mixed zoning required");
      if (c === "no_flood" && h.floodRisk > 0.45) blockedBy.push("Flood risk exceeds 45%");
      if (c === "no_industrial" && h.landuse === "industrial") blockedBy.push("Industrial zoning excluded");
      if (c === "high_visibility" && h.footfall < 0.45) blockedBy.push("Insufficient foot traffic");
    }
    if (config.landUseTable[h.landuse] === 0) blockedBy.push("Land use excluded");
    const parts = weights.map(([layer,w]) => ({layer, label:FACTORS[layer]!, weight:w/total, value:values[layer]!, contribution:w/total*values[layer]!}));
    const score = clamp(parts.reduce((s,p) => s+p.contribution,0));
    const subscores = Object.fromEntries(Object.entries(values).map(([k,v]) => [k,Math.round(v*100)])) as ScoredHex["subscores"];
    return {h,parts,score,subscores,blockedBy,density};
  });
  const byId = new Map(cells.map(c => [c.h.h3,c.score]));
  const n = cells.length;
  const mean = cells.reduce((s,c) => s+c.score,0)/n;
  const sd = Math.sqrt(cells.reduce((s,c) => s+(c.score-mean)**2,0)/n);
  return cells.map(c => {
    const values = gridDisk(c.h.h3,2).map(id => byId.get(id)).filter((v): v is number => v !== undefined);
    const k = values.length;
    // Getis-Ord Gi*: binary neighborhood weights with self and finite population correction.
    const denominator = n>1 ? sd*Math.sqrt((n*k-k*k)/(n-1)) : 0;
    const gi = denominator > 0 ? (values.reduce((s,v)=>s+v,0)-mean*k)/denominator : 0;
    const localMean = values.reduce((s,v)=>s+v,0)/k;
    const spread = Math.sqrt(values.reduce((s,v)=>s+(v-localMean)**2,0)/k);
    const demand = (c.h.population+c.h.footfall)/2;
    return {
      ...c.h, raw:c.h, competition:c.density, landuse:config.landUseTable[c.h.landuse],
      score:c.score,score100:Math.round(c.score*100), eligible:!c.blockedBy.length,blockedBy:c.blockedBy,
      parts:c.parts,subscores:c.subscores,gi,gi_z:gi,underserved:demand>0.55 && c.density<0.4,
      underservedScore:Math.max(0,demand-c.density),robustness:spread<0.05?"high":spread<0.1?"medium":"low",
    };
  });
}
export function topSites(scored: ScoredHex[], n=5) {
  return scored.filter(h=>h.eligible).sort((a,b)=>b.score-a.score || a.h3.localeCompare(b.h3)).slice(0,n);
}

