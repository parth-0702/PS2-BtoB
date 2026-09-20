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
  radius_km?: number;
  hex_count?: number;
  population: number;
  incremental_population?: number;
  area_km2: number;
  incremental_area_km2?: number;
  competitors_within_band?: number;
  polygon: [number, number][];
}

export interface AiExplanation {
  summary: string;
  strengths: string[];
  risks: string[];
  recommendation?: string;
  suggestion?: string;
  key_drivers?: string[];
  source: "gemini" | "deterministic_engine" | "template";
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

export async function scorePoint(cityId: string, lat: number, lng: number, config?: object): Promise<any | null> {
  return post("/score/point", { city_id: cityId, lat, lng, config });
}

export async function fetchClusters(cityId: string): Promise<{ clusters: object[]; total: number } | null> {
  return post("/analysis/clusters", { city_id: cityId });
}

export async function fetchHotspots(cityId: string, config?: object): Promise<any | null> {
  return post("/analysis/hotspots", { city_id: cityId, config });
}

export async function fetchIsochrone(
  cityId: string,
  lat: number,
  lng: number,
  mode: "walk" | "drive",
  minutes: number[],
): Promise<{ bands: IsochroneBand[]; provider_used?: string; elapsed_ms?: number } | null> {
  return post("/analysis/isochrone", { city_id: cityId, lat, lng, mode, minutes });
}

export async function explainSite(site: object, business: string = "retail store"): Promise<AiExplanation | null> {
  return post<AiExplanation>("/ai/explain", { site, business_type: business });
}

export async function compareSites(sites: object[], business: string = "retail store"): Promise<object | null> {
  return post("/ai/compare", { sites, business_type: business });
}

export async function fetchSensitivity(cityId: string, config?: object): Promise<any | null> {
  return post("/ai/sensitivity", { city_id: cityId, config, n_simulations: 100, top_n: 15 });
}

export async function downloadReport(
  cityId: string,
  business: string = "Retail Store",
  config?: object,
  aiExplanation?: object,
  selectedH3?: string | null,
): Promise<void> {
  const resp = await fetch(`${BASE_URL}/analysis/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      city_id: cityId,
      business_type: business,
      config: config || {},
      ai_explanation: aiExplanation,
      h3: selectedH3 || undefined,
    }),
  });
  if (!resp.ok) throw new Error("Report download failed");
  const blob = await resp.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SiteScope_Report_${cityId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
