import { cellToBoundary, cellToLatLng, gridDisk, latLngToCell } from "h3-js";
import type { City, CityData, HexCell, LayerCoverage } from "./types";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface CitySeed {
  id: string;
  name: string;
  region: string;
  center: [number, number];
  rings: number;
  blurb: string;
  coverage: Record<string, number>;
  hubs: [number, number, number][]; // lng, lat, strength
}

const CITY_SEEDS: CitySeed[] = [
  {
    id: "ahmedabad",
    name: "Ahmedabad",
    region: "Gujarat, India",
    center: [72.5714, 23.0225],
    rings: 14,
    blurb: "Commercial capital of Gujarat, vibrant business districts along SG Highway, Ashram Road & dense walled city.",
    coverage: {
      population: 0.99,
      footfall: 0.94,
      accessibility: 0.96,
      complementary: 0.92,
      competition: 0.88,
      rent: 0.82,
    },
    hubs: [
      [72.5714, 23.0225, 1],
      [72.5085, 23.0338, 0.95], // SG Highway / Vastrapur
      [72.5293, 23.0754, 0.8], // Chandkheda / Motera
      [72.5925, 23.0035, 0.75], // Maninagar
      [72.5620, 23.0380, 0.9], // Navrangpura / CG Road
    ],
  },
  {
    id: "surat",
    name: "Surat",
    region: "Gujarat, India",
    center: [72.8311, 21.1702],
    rings: 13,
    blurb: "Diamond and textile hub on the Tapi, dense core with fast-growing western suburbs like Vesu and Adajan.",
    coverage: {
      population: 0.98,
      footfall: 0.91,
      accessibility: 0.95,
      complementary: 0.88,
      competition: 0.84,
      rent: 0.72,
    },
    hubs: [
      [72.8311, 21.1702, 1],
      [72.795, 21.19, 0.85],
      [72.87, 21.155, 0.7],
      [72.79, 21.145, 0.6],
      [72.86, 21.21, 0.5],
    ],
  },
  {
    id: "vadodara",
    name: "Vadodara",
    region: "Gujarat, India",
    center: [73.1812, 22.3072],
    rings: 11,
    blurb: "Compact cultural city with a strong student population and a steady commercial spine along Alkapuri.",
    coverage: {
      population: 0.94,
      footfall: 0.78,
      accessibility: 0.9,
      complementary: 0.81,
      competition: 0.76,
      rent: 0.64,
    },
    hubs: [
      [73.1812, 22.3072, 1],
      [73.15, 22.33, 0.72],
      [73.21, 22.28, 0.6],
    ],
  },
  {
    id: "rajkot",
    name: "Rajkot",
    region: "Gujarat, India",
    center: [70.8022, 22.3039],
    rings: 10,
    blurb: "Fast-growing engineering town, ring-road retail and price-sensitive commercial hubs on Yagnik Road.",
    coverage: {
      population: 0.9,
      footfall: 0.7,
      accessibility: 0.86,
      complementary: 0.74,
      competition: 0.69,
      rent: 0.58,
    },
    hubs: [
      [70.8022, 22.3039, 1],
      [70.78, 22.28, 0.66],
      [70.83, 22.33, 0.55],
    ],
  },
];

const LAYER_SOURCES: Record<string, string> = {
  population: "WorldPop GeoTIFF (Census Raster)",
  footfall: "Synthetic mobility footfall traces",
  accessibility: "OSM Road + Transit Network Graph",
  complementary: "OSM POI amenity datasets",
  competition: "OSM competitor points + synthetic POIs",
  rent: "Sample listings & land registry",
};

const LAYER_LABELS: Record<string, string> = {
  population: "Population & Demographics",
  footfall: "Pedestrian Footfall",
  accessibility: "Transportation & Transit",
  complementary: "Complementary POIs",
  competition: "Competitors",
  rent: "Rent / Budget Index",
};

function coverageList(seed: CitySeed): LayerCoverage[] {
  return Object.entries(seed.coverage).map(([id, coverage]) => ({
    id: id as LayerCoverage["id"],
    label: LAYER_LABELS[id] ?? id,
    coverage,
    source: LAYER_SOURCES[id] ?? "Synthetic",
  }));
}

const RES = 8;

function cellsFor(seed: CitySeed) {
  const origin = latLngToCell(seed.center[1], seed.center[0], RES);
  return gridDisk(origin, seed.rings);
}

export function listCities(): City[] {
  return CITY_SEEDS.map((seed) => ({
    id: seed.id,
    name: seed.name,
    region: seed.region,
    center: seed.center,
    hexCount: cellsFor(seed).length,
    resolution: RES,
    blurb: seed.blurb,
    layers: coverageList(seed),
  }));
}

function distanceKm(a: [number, number], b: [number, number]) {
  const dx = (a[0] - b[0]) * 111 * Math.cos((a[1] * Math.PI) / 180);
  const dy = (a[1] - b[1]) * 111;
  return Math.sqrt(dx * dx + dy * dy);
}

function hubPull(pt: [number, number], hubs: [number, number, number][]) {
  let v = 0;
  for (const [lng, lat, strength] of hubs) {
    const d = distanceKm(pt, [lng, lat]);
    v += strength * Math.exp(-(d * d) / 8);
  }
  return Math.min(1, v);
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function buildCityData(cityId: string): CityData {
  const seed = CITY_SEEDS.find((c) => c.id === cityId) ?? CITY_SEEDS[0]!;
  const cells = cellsFor(seed);
  const hexes: HexCell[] = cells.map((h3) => {
    const rnd = mulberry32(hash(h3));
    const [lat, lng] = cellToLatLng(h3);
    const center: [number, number] = [lng, lat];
    const pull = hubPull(center, seed.hubs);
    const noise = () => rnd() * 0.35 - 0.175;

    const population = clamp01(pull * 0.75 + 0.2 + noise());
    const footfall = clamp01(pull * 0.9 + noise());
    const accessibility = clamp01(pull * 0.6 + 0.3 + noise());
    const complementary = clamp01(footfall * 0.7 + noise());
    const competition = clamp01(footfall * 0.75 + noise());
    const rent = clamp01(pull * 0.8 + 0.15 + noise() * 0.6);

    const r = rnd();
    const landuse: HexCell["landuse"] =
      footfall > 0.6 ? (r > 0.4 ? "commercial" : "mixed") : r > 0.85 ? "industrial" : r > 0.5 ? "residential" : "mixed";

    return {
      h3,
      center,
      boundary: cellToBoundary(h3, true) as [number, number][],
      population,
      footfall,
      accessibility,
      complementary,
      competition,
      rent,
      landuse,
      floodRisk: clamp01(0.5 - pull * 0.3 + noise()),
      parking: clamp01(0.7 - footfall * 0.5 + noise()),
    };
  });

  const competitors = hexes
    .filter((h) => h.competition > 0.62)
    .slice(0, 160)
    .map((h, i) => {
      const rnd = mulberry32(hash(h.h3 + "c"));
      return {
        id: `${seed.id}-c${i}`,
        name: `Competitor ${i + 1}`,
        lngLat: [h.center[0] + (rnd() - 0.5) * 0.004, h.center[1] + (rnd() - 0.5) * 0.004] as [number, number],
      };
    });

  return {
    city: {
      id: seed.id,
      name: seed.name,
      region: seed.region,
      center: seed.center,
      hexCount: cells.length,
      resolution: RES,
      blurb: seed.blurb,
      layers: coverageList(seed),
    },
    hexes,
    competitors,
  };
}
