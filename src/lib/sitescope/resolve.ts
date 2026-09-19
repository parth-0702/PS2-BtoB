import type { Answers, LayerId, ResolveResult, ScoringConfig } from "./types";

const BASE: ScoringConfig = {
  weights: {
    population: 0.2,
    footfall: 0.2,
    accessibility: 0.15,
    complementary: 0.15,
    competition: 0.2,
    rent: 0.1,
  },
  decayD0: 900,
  competitionMode: "avoid",
  competitionRadius: 800,
  constraints: [],
  competitorCategories: [],
  complementaryCategories: [],
  landUseTable: { commercial: 1, mixed: 0.85, residential: 0.6, industrial: 0.25 },
  isochroneMode: "walk",
  isochroneMinutes: 10,
  scale: "medium",
};

const BUSINESS: Record<
  string,
  { competitors: string[]; complementary: string[]; bump: Partial<Record<LayerId, number>>; label: string }
> = {
  cafe: {
    label: "café",
    competitors: ["cafe", "coffee_shop", "bakery"],
    complementary: ["office", "college", "bookstore", "co_working"],
    bump: { footfall: 0.08, complementary: 0.04 },
  },
  restaurant: {
    label: "restaurant",
    competitors: ["restaurant", "fast_food"],
    complementary: ["cinema", "mall", "hotel"],
    bump: { footfall: 0.06, accessibility: 0.04 },
  },
  grocery: {
    label: "grocery store",
    competitors: ["supermarket", "convenience", "kirana"],
    complementary: ["residential_complex", "school", "pharmacy"],
    bump: { population: 0.1 },
  },
  pharmacy: {
    label: "pharmacy",
    competitors: ["pharmacy"],
    complementary: ["clinic", "hospital", "residential_complex"],
    bump: { population: 0.08, complementary: 0.06 },
  },
  gym: {
    label: "gym",
    competitors: ["gym", "fitness_centre"],
    complementary: ["residential_complex", "juice_bar", "office"],
    bump: { population: 0.06, accessibility: 0.05 },
  },
  salon: {
    label: "salon",
    competitors: ["hairdresser", "beauty_salon", "spa"],
    complementary: ["mall", "apparel", "gym"],
    bump: { footfall: 0.05, population: 0.04 },
  },
  clinic: {
    label: "clinic",
    competitors: ["clinic", "doctor"],
    complementary: ["pharmacy", "diagnostic_lab", "residential_complex"],
    bump: { population: 0.09, accessibility: 0.04 },
  },
  retail: {
    label: "retail store",
    competitors: ["clothes", "shoes", "department_store"],
    complementary: ["mall", "cafe", "cinema"],
    bump: { footfall: 0.09 },
  },
};

const CUSTOMER: Record<string, { label: string; bump: Partial<Record<LayerId, number>>; note: string }> = {
  families: { label: "families", bump: { population: 0.1, rent: 0.02 }, note: "weight residential population higher" },
  students: { label: "students", bump: { footfall: 0.07, rent: 0.05 }, note: "favour busy, affordable streets" },
  office: { label: "office workers", bump: { footfall: 0.09, accessibility: 0.03 }, note: "favour workday footfall" },
  young: { label: "young professionals", bump: { footfall: 0.06, complementary: 0.05 }, note: "favour lively mixed areas" },
  tourists: { label: "visitors", bump: { footfall: 0.1, accessibility: 0.04 }, note: "favour high-visibility streets" },
  premium: { label: "premium customers", bump: { complementary: 0.07, rent: -0.04 }, note: "rent matters less" },
};

const PRIORITY: Record<string, { layer: LayerId; label: string }> = {
  foot_traffic: { layer: "footfall", label: "foot traffic" },
  nearby_customers: { layer: "population", label: "customers living nearby" },
  low_rent: { layer: "rent", label: "low rent" },
  easy_access: { layer: "accessibility", label: "easy access and parking" },
  low_competition: { layer: "competition", label: "little competition" },
  good_neighbours: { layer: "complementary", label: "good neighbouring businesses" },
};

const TRAVEL: Record<string, { d0: number; mode: "walk" | "drive"; minutes: number; label: string }> = {
  walk10: { d0: 800, mode: "walk", minutes: 10, label: "a 10 minute walk" },
  drive10: { d0: 2500, mode: "drive", minutes: 10, label: "a 10 minute drive" },
  drive20: { d0: 5000, mode: "drive", minutes: 20, label: "a 20 minute drive" },
  drive30: { d0: 8000, mode: "drive", minutes: 30, label: "a 30 minute drive" },
};

export const CONSTRAINT_LABELS: Record<string, string> = {
  max_rent: "Rent must stay in the affordable half of the city",
  needs_parking: "Parking must be available",
  ground_floor_commercial: "Commercial or mixed-use land only",
  no_flood: "Flood-prone hexes are excluded",
  no_industrial: "Industrial zones are excluded",
  high_visibility: "Only high-footfall, main-road hexes",
};

const SCALE: Record<string, { label: string; bump: Partial<Record<LayerId, number>> }> = {
  small: { label: "small format", bump: { footfall: 0.06, rent: 0.04 } },
  medium: { label: "medium format", bump: {} },
  large: { label: "large format", bump: { accessibility: 0.08, population: 0.05, rent: -0.02 } },
};

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

function normalise(weights: Record<LayerId, number>) {
  const keys = Object.keys(weights) as LayerId[];
  for (const k of keys) weights[k] = clamp(weights[k]!, 0.01, 0.6);
  const sum = keys.reduce((s, k) => s + weights[k]!, 0);
  for (const k of keys) weights[k] = Number((weights[k]! / sum).toFixed(4));
  return weights;
}

function applyBump(w: Record<LayerId, number>, bump: Partial<Record<LayerId, number>>) {
  for (const [k, v] of Object.entries(bump)) w[k as LayerId] = (w[k as LayerId] ?? 0) + (v ?? 0);
}

/** Keyword interpreter used when a free-text answer is given. */
function interpretCustomText(text: string, config: ScoringConfig): string[] {
  const t = text.toLowerCase();
  const notes: string[] = [];
  const w = config.weights;

  const has = (...k: string[]) => k.some((x) => t.includes(x));

  if (has("cheap", "affordable", "low rent", "budget", "sasta")) {
    w['rent'] = (w['rent'] ?? 0.1) + 0.08;
    notes.push("Rent weighted more heavily from your own words");
  }
  if (has("busy", "crowd", "foot", "traffic", "market", "main road", "visibility")) {
    w['footfall'] = (w['footfall'] ?? 0.2) + 0.08;
    notes.push("Busy, visible streets weighted higher from your own words");
  }
  if (has("quiet", "residential", "neighbourhood", "society", "apartment")) {
    w['population'] = (w['population'] ?? 0.2) + 0.08;
    notes.push("Residential catchment weighted higher from your own words");
  }
  if (has("parking", "car", "drive", "scooter", "bike")) {
    w['accessibility'] = (w['accessibility'] ?? 0.15) + 0.07;
    config.constraints = Array.from(new Set([...config.constraints, "needs_parking"]));
    notes.push("Access and parking treated as important from your own words");
  }
  if (has("no competitor", "avoid competit", "away from competit")) {
    config.competitionMode = "avoid";
    w['competition'] = (w['competition'] ?? 0.2) + 0.06;
    notes.push("Competitors avoided based on your own words");
  }
  if (has("cluster", "next to similar", "near other")) {
    config.competitionMode = "cluster";
    notes.push("Clustering with similar businesses, based on your own words");
  }
  if (has("flood", "waterlog")) {
    config.constraints = Array.from(new Set([...config.constraints, "no_flood"]));
    notes.push("Flood-prone areas excluded from your own words");
  }
  const min = t.match(/(\d{1,2})\s*(min|minute)/);
  if (min) {
    const m = Number(min[1]);
    config.isochroneMinutes = clamp(m, 5, 45);
    config.decayD0 = clamp(m * (t.includes("walk") ? 80 : 300), 400, 9000);
    config.isochroneMode = t.includes("walk") ? "walk" : "drive";
    notes.push(`Travel tolerance set to ${config.isochroneMinutes} minutes from your own words`);
  }
  const km = t.match(/(\d+(?:\.\d+)?)\s*km/);
  if (km) {
    config.competitionRadius = clamp(Number(km[1]) * 1000, 200, 5000);
    notes.push(`Competitor radius set to ${Math.round(config.competitionRadius)} m from your own words`);
  }
  if (!notes.length) notes.push(`Noted: "${text.trim()}" (no clear rule found, defaults kept)`);
  return notes;
}

export function resolveAnswers(answers: Answers): ResolveResult {
  const config: ScoringConfig = {
    ...BASE,
    weights: { ...BASE.weights },
    constraints: [],
    landUseTable: { ...BASE.landUseTable },
  };
  const interpretation: string[] = [];
  let fallbackUsed = false;

  const pick = (q: string) => answers[q]?.optionIds?.[0];
  const all = (q: string) => answers[q]?.optionIds ?? [];
  const custom = (q: string) => answers[q]?.customText?.trim();

  // Q1 business type
  const biz = BUSINESS[pick("q1") ?? ""];
  if (biz) {
    applyBump(config.weights, biz.bump);
    config.competitorCategories = biz.competitors;
    config.complementaryCategories = biz.complementary;
    interpretation.push(`Scoring for a ${biz.label}; competitors are ${biz.competitors.join(", ")}`);
  } else if (!custom("q1")) {
    fallbackUsed = true;
    config.competitorCategories = BUSINESS['cafe']!.competitors;
    interpretation.push("No business type chosen — using a general high-street retail profile");
  }

  // Q2 customer
  const cust = CUSTOMER[pick("q2") ?? ""];
  if (cust) {
    applyBump(config.weights, cust.bump);
    interpretation.push(`Targeting ${cust.label} — ${cust.note}`);
  }

  // Q3 competitors
  const comp = pick("q3");
  if (comp === "cluster") {
    config.competitionMode = "cluster";
    config.competitionRadius = 600;
    interpretation.push("Cluster with competitors — busy strips score higher");
  } else if (comp === "neutral") {
    config.competitionMode = "neutral";
    config.weights['competition'] = 0.06;
    interpretation.push("Competitors are treated as neutral");
  } else if (comp === "avoid") {
    config.competitionMode = "avoid";
    config.competitionRadius = 1000;
    config.weights['competition'] = (config.weights['competition'] ?? 0.2) + 0.06;
    interpretation.push("Avoid competitors within 1 km");
  }

  // Q4 priorities, ranked
  const prios = all("q4").slice(0, 3);
  prios.forEach((p, i) => {
    const entry = PRIORITY[p];
    if (!entry) return;
    const boost = [0.14, 0.09, 0.05][i] ?? 0.04;
    config.weights[entry.layer] = (config.weights[entry.layer] ?? 0.15) + boost;
    interpretation.push(`Priority ${i + 1}: ${entry.label}`);
  });

  // Q5 travel
  const travel = TRAVEL[pick("q5") ?? ""];
  if (travel) {
    config.decayD0 = travel.d0;
    config.isochroneMode = travel.mode;
    config.isochroneMinutes = travel.minutes;
    interpretation.push(`Customers will travel about ${travel.label} (distance decay ${travel.d0} m)`);
  }

  // Q6 constraints
  const cons = all("q6");
  config.constraints = [...cons];
  for (const c of cons) interpretation.push(CONSTRAINT_LABELS[c] ?? c);
  if (cons.includes("no_industrial")) config.landUseTable.industrial = 0;
  if (cons.includes("ground_floor_commercial")) {
    config.landUseTable.residential = 0;
    config.landUseTable.industrial = 0;
  }

  // Q7 scale
  const scale = SCALE[pick("q7") ?? ""];
  if (scale) {
    config.scale = (pick("q7") as ScoringConfig["scale"]) ?? "medium";
    applyBump(config.weights, scale.bump);
    interpretation.push(`${scale.label[0]!.toUpperCase()}${scale.label.slice(1)} outlet`);
  }

  // Free text on any question
  for (const q of ["q1", "q2", "q3", "q4", "q5", "q6", "q7"]) {
    const text = custom(q);
    if (!text) continue;
    fallbackUsed = true;
    interpretation.push(...interpretCustomText(text, config));
  }

  normalise(config.weights);
  return { config, interpretation, fallbackUsed };
}

export const DEFAULT_ANSWERS: Answers = {
  q1: { optionIds: ["cafe"] },
  q2: { optionIds: ["young"] },
  q3: { optionIds: ["avoid"] },
  q4: { optionIds: ["foot_traffic", "nearby_customers", "low_rent"] },
  q5: { optionIds: ["walk10"] },
  q6: { optionIds: ["needs_parking"] },
  q7: { optionIds: ["small"] },
};
