/**
 * api.ts — Backend API client for SiteScope.
 * Falls back gracefully to mock/offline mode when the backend is unreachable.
 */

const BASE_URL = "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null; // backend not reachable
  }
}

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`);
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScoredHexAPI {
  h3: string;
  lat: number;
  lng: number;
  score: number;
  eligible: boolean;
  blocked_by: string;
  gi_z: number;
  hotspot: string;
  underserved: boolean;
  high_potential: boolean;
  sub_demand: number;
  sub_accessibility: number;
  sub_complementary: number;
  sub_competition: number;
  sub_landuse: number;
  sub_risk: number;
}

export interface ScoreResponse {
  summary: {
    total_hexes: number;
    eligible_hexes: number;
    avg_score: number;
    high_potential: number;
    underserved: number;
    hot_spots: number;
    cold_spots: number;
  };
  top3: ScoredHexAPI[];
  hexes: ScoredHexAPI[];
}

export interface CityMeta {
  id: string;
  name: string;
  region: string;
  center: [number, number];
  hex_count: number;
  blurb: string;
  layers: Array<{
    id: string;
    label: string;
    coverage: number;
    synthetic: boolean;
    source: string;
  }>;
}

export interface IsochroneBand {
  minutes: number;
  mode: string;
  radius_km: number;
  hex_count: number;
  population: number;
  area_km2: number;
  polygon: [number, number][];
}

export interface AiExplanation {
  summary: string;
  strengths: string[];
  risks: string[];
  suggestion: string;
  source: "gemini" | "template";
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchCities(): Promise<CityMeta[] | null> {
  return get<CityMeta[]>("/cities");
}

export async function fetchCityMeta(cityId: string): Promise<CityMeta | null> {
  return get<CityMeta>(`/cities/${cityId}/meta`);
}

export async function scoreCity(cityId: string, config: object): Promise<ScoreResponse | null> {
  return post<ScoreResponse>("/score", { city_id: cityId, config });
}

export async function fetchClusters(cityId: string): Promise<{ clusters: object[]; total: number } | null> {
  return post("/analysis/clusters", { city_id: cityId });
}

export async function fetchIsochrone(
  cityId: string,
  lat: number,
  lng: number,
  mode: "walk" | "drive",
  minutes: number[],
): Promise<{ bands: IsochroneBand[] } | null> {
  return post("/analysis/isochrone", { city_id: cityId, lat, lng, mode, minutes });
}

export async function explainSite(site: object, business: string): Promise<AiExplanation | null> {
  return post<AiExplanation>("/ai/explain", { site, business });
}

export async function compareSites(sites: object[], business: string): Promise<object | null> {
  return post("/ai/compare", { sites, business });
}
