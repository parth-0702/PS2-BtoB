export type LayerId =
  | "population"
  | "footfall"
  | "accessibility"
  | "complementary"
  | "competition"
  | "rent"
  | "demand"
  | "landuse"
  | "risk";

export const LAYER_META: { id: LayerId; label: string; hint: string }[] = [
  { id: "population", label: "Population", hint: "Residents per hex" },
  { id: "footfall", label: "Footfall", hint: "Daily pedestrian flow" },
  { id: "accessibility", label: "Accessibility", hint: "Road + transit reach" },
  { id: "complementary", label: "Complementary POIs", hint: "Businesses that pull the same crowd" },
  { id: "competition", label: "Competition", hint: "Direct competitors nearby" },
  { id: "rent", label: "Rent", hint: "Indicative rent per sq ft" },
];

export interface LayerCoverage {
  id: LayerId;
  label: string;
  coverage: number; // 0..1
  source: string;
}

export interface City {
  id: string;
  name: string;
  region: string;
  center: [number, number];
  hexCount: number;
  resolution: number;
  blurb: string;
  layers: LayerCoverage[];
}

export interface HexCell {
  h3: string;
  center: [number, number];
  boundary: [number, number][];
  population: number;
  footfall: number;
  accessibility: number;
  complementary: number;
  competition: number;
  rent: number;
  landuse: "residential" | "commercial" | "mixed" | "industrial";
  floodRisk: number;
  parking: number;
}

export interface CityData {
  city: City;
  hexes: HexCell[];
  competitors: { id: string; name: string; lngLat: [number, number] }[];
}

export type CompetitionMode = "avoid" | "neutral" | "cluster";

export interface ScoringConfig {
  weights: Record<LayerId | string, number>;
  decayD0: number; // metres
  decay?: { type?: string; d0?: number; d0_km?: number };
  competitionMode: CompetitionMode;
  competition?: { mode?: CompetitionMode; radius?: number; radius_km?: number; saturation?: number };
  competitionRadius: number; // metres
  constraints: string[];
  competitorCategories: string[];
  complementaryCategories: string[];
  landUseTable: Record<HexCell["landuse"], number>;
  isochroneMode: "walk" | "drive";
  isochroneMinutes: number;
  scale: "small" | "medium" | "large";
}

export interface ResolveResult {
  config: ScoringConfig;
  interpretation: string[];
  fallbackUsed: boolean;
}

export type AnswerValue = { optionIds: string[]; customText?: string | undefined };
export type Answers = Record<string, AnswerValue>;

