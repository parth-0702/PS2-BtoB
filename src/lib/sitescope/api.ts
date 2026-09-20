/**
 * api.ts — Real Location Intelligence API Client for SiteScope.
 * Connects frontend dashboard directly to FastAPI backend (localhost:8000).
 */

const API_BASE = "http://127.0.0.1:8000";

export async function fetchCities() {
  const resp = await fetch(`${API_BASE}/cities`);
  if (!resp.ok) throw new Error("Failed to fetch cities from backend");
  return resp.json();
}

export async function fetchCityHexes(cityId: string) {
  const resp = await fetch(`${API_BASE}/cities/${cityId}/hexes`);
  if (!resp.ok) throw new Error(`Failed to fetch hexes for city: ${cityId}`);
  return resp.json();
}

export async function fetchCityMeta(cityId: string) {
  const resp = await fetch(`${API_BASE}/cities/${cityId}/meta`);
  if (!resp.ok) throw new Error(`Failed to fetch meta for city: ${cityId}`);
  return resp.json();
}

export async function fetchCityLayer(cityId: string, layerName: string) {
  const resp = await fetch(`${API_BASE}/cities/${cityId}/layers/${layerName}`);
  if (!resp.ok) throw new Error(`Failed to fetch layer ${layerName} for ${cityId}`);
  return resp.json();
}

export async function scorePoint(payload: {
  city_id: string;
  lat: number;
  lng: number;
  config?: any;
}) {
  const resp = await fetch(`${API_BASE}/score/point`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error("Point scoring failed");
  return resp.json();
}

export async function fetchScoredHexes(cityId: string, config: any) {
  const resp = await fetch(`${API_BASE}/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      city_id: cityId,
      config: {
        preset: config.preset || "retail_store",
        weights: {
          demand: Number(config.weights?.demand ?? config.weights?.population ?? 30),
          accessibility: Number(config.weights?.accessibility ?? 25),
          complementary: Number(config.weights?.complementary ?? 15),
          competition: Number(config.weights?.competition ?? 20),
          landuse: Number(config.weights?.landuse ?? 15),
          risk: Number(config.weights?.risk ?? 10),
        },
        decay: {
          type: config.decay?.type ?? config.decayType ?? "exponential",
          d0_km: Number(config.decay?.d0_km ?? (config.decayD0 ? config.decayD0 / 1000 : 1.2)),
        },
        competition: {
          mode: config.competition?.mode ?? config.competitionMode ?? "penalise",
          radius_km: Number(config.competition?.radius_km ?? config.competition?.radius ?? 1.0),
          saturation: Number(config.competition?.saturation ?? 5.0),
          sweet_spot: 2.0,
        },
        constraints: (config.constraints || []).map((c: string) => ({
          feature: c === "no_flood" ? "flood_susceptibility" : c === "needs_parking" ? "built_up_ratio" : "dominant_landuse",
          op: "<=",
          value: 0.70,
          label: c,
        })),
      },
    }),
  });
  if (!resp.ok) throw new Error("City scoring failed");
  return resp.json();
}

export async function fetchHotspots(payload: {
  city_id: string;
  config?: any;
  k_rings?: number;
  permutations?: number;
}) {
  const resp = await fetch(`${API_BASE}/analysis/hotspots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error("Hotspot computation failed");
  return resp.json();
}

export async function fetchClusters(payload: {
  city_id: string;
  categories?: string[];
  eps_km?: number;
  min_samples?: number;
}) {
  const resp = await fetch(`${API_BASE}/analysis/clusters`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error("Cluster computation failed");
  return resp.json();
}

export async function fetchIsochrones(payload: {
  city_id: string;
  lat: number;
  lng: number;
  mode: "drive" | "walk";
  minutes?: number[];
}) {
  const resp = await fetch(`${API_BASE}/analysis/isochrone`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error("Isochrone computation failed");
  return resp.json();
}

export async function analyzePolygon(payload: {
  city_id: string;
  polygon: [number, number][];
  scored_hexes?: any[];
}) {
  const resp = await fetch(`${API_BASE}/analysis/polygon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error("Polygon analysis failed");
  return resp.json();
}

export async function parseNaturalLanguageBusiness(description: string) {
  const resp = await fetch(`${API_BASE}/ai/parse-business`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!resp.ok) throw new Error("AI business parsing failed");
  return resp.json();
}

export async function explainSite(payload: {
  site: any;
  business_type?: string;
}) {
  const resp = await fetch(`${API_BASE}/ai/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error("AI site explanation failed");
  return resp.json();
}

export async function compareSites(payload: {
  sites: any[];
  business_type?: string;
}) {
  const resp = await fetch(`${API_BASE}/ai/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error("AI site comparison failed");
  return resp.json();
}

export async function runSensitivityAnalysis(payload: {
  city_id: string;
  config?: any;
  n_simulations?: number;
  jitter_pct?: number;
  top_n?: number;
}) {
  const resp = await fetch(`${API_BASE}/ai/sensitivity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error("Sensitivity analysis failed");
  return resp.json();
}

export async function downloadPdfReport(payload: {
  city_id: string;
  business_type?: string;
  config?: any;
  ai_explanation?: any;
}) {
  const resp = await fetch(`${API_BASE}/analysis/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error("PDF report generation failed");
  const blob = await resp.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SiteScope_Report_${payload.city_id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
