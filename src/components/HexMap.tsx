import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type * as GeoJSON from "geojson";
import type { ScoredHex } from "@/lib/sitescope/scoring";
import { Layers, Plus, Minus, Crosshair, Users, Route, Store, ShieldAlert, Compass, Building2 } from "lucide-react";
import { MapLayersPanel, type LayerItem } from "./MapLayersPanel";

const BASE_URL = import.meta.env["VITE_API_URL"] || "http://localhost:8000";

function scoreToColor(score: number): string {
  const s = Math.max(0, Math.min(1, Number.isFinite(score) ? score : 0.5));
  if (s < 0.25) {
    const t = s / 0.25;
    return `rgba(${Math.round(59 + t * 20)}, ${Math.round(130 + t * 40)}, ${Math.round(246 - t * 20)}, 0.70)`;
  }
  if (s < 0.50) {
    const t = (s - 0.25) / 0.25;
    return `rgba(${Math.round(16 + t * 40)}, ${Math.round(185 + t * 10)}, ${Math.round(129 - t * 40)}, 0.72)`;
  }
  if (s < 0.75) {
    const t = (s - 0.50) / 0.25;
    return `rgba(${Math.round(245 + t * 10)}, ${Math.round(158 - t * 40)}, ${Math.round(11 + t * 10)}, 0.75)`;
  }
  const t = (s - 0.75) / 0.25;
  return `rgba(${Math.round(239 + t * 16)}, ${Math.round(68 - t * 30)}, ${Math.round(68 - t * 30)}, 0.85)`;
}

interface HexMapProps {
  scored: ScoredHex[];
  center: [number, number];
  onHexClick: (h3: string) => void;
  selectedH3: string | null;
  topSitesList?: ScoredHex[];
  mapStyleType?: "map" | "satellite" | "hybrid";
  onStyleChange?: (style: "map" | "satellite" | "hybrid") => void;
  competitors?: { id: string; name: string; lngLat: [number, number] }[];
  cityId: string;
  layersList?: LayerItem[];
  onToggleLayer?: (id: string) => void;
  onLayerOpacity?: (id: string, opacity: number) => void;
}

interface LayerStyle {
  type: "fill" | "line" | "circle" | "symbol";
  paint: Record<string, any>;
  layout?: Record<string, any>;
}

const LAYER_STYLES: Record<string, LayerStyle> = {
  landuse: {
    type: "fill",
    paint: {
      "fill-color": [
        "match",
        ["get", "landuse"],
        "residential", "#fef3c7",
        "commercial", "#fecaca",
        "industrial", "#e5e7eb",
        "mixed", "#fde68a",
        "forest", "#86efac",
        "agricultural", "#fef08a",
        "water", "#93c5fd",
        "#e5e7eb"
      ],
      "fill-opacity": 0.6,
      "fill-outline-color": "#9ca3af",
    },
  },
  roads: {
    type: "line",
    paint: {
      "line-color": "#9ca3af",
      "line-width": 0.8,
      "line-opacity": 0.8,
    },
  },
  transit: {
    type: "line",
    paint: {
      "line-color": "#38bdf8",
      "line-width": 1.2,
      "line-opacity": 0.9,
      "line-dasharray": [4, 4],
    },
  },
  waterways: {
    type: "line",
    paint: {
      "line-color": "#0ea5e9",
      "line-width": 1.0,
      "line-opacity": 0.7,
    },
  },
  pois: {
    type: "circle",
    paint: {
      "circle-radius": 3,
      "circle-color": "#f43f5e",
      "circle-opacity": 0.8,
      "circle-stroke-width": 0.5,
      "circle-stroke-color": "#ffffff",
    },
  },
  flood: {
    type: "fill",
    paint: {
      "fill-color": "#f97316",
      "fill-opacity": 0.4,
    },
  },
};

export function HexMap({
  scored,
  center,
  onHexClick,
  selectedH3,
  topSitesList = [],
  mapStyleType = "map",
  onStyleChange,
  competitors = [],
  cityId,
  layersList = [
    { id: "population", name: "Population & Demographics", enabled: true, opacity: 80, coverage: "99% coverage", icon: <Users className="w-3.5 h-3.5 text-blue-500" /> },
    { id: "roads", name: "Transportation & Transit", enabled: true, opacity: 70, coverage: "96% coverage", icon: <Route className="w-3.5 h-3.5 text-emerald-500" /> },
    { id: "competitors", name: "Points of Interest & Competitors", enabled: true, opacity: 60, coverage: "92% coverage", isSynthetic: true, icon: <Store className="w-3.5 h-3.5 text-rose-500" /> },
    { id: "landuse", name: "Land Use & Zoning", enabled: true, opacity: 70, coverage: "88% coverage", icon: <Building2 className="w-3.5 h-3.5 text-purple-500" /> },
    { id: "flood", name: "Environmental & Flood Risk", enabled: false, opacity: 50, coverage: "82% coverage", isSynthetic: true, icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> },
  ],
  onToggleLayer,
  onLayerOpacity,
}: HexMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const onClickRef = useRef(onHexClick);
  onClickRef.current = onHexClick;

  const [activeMapType, setActiveMapType] = useState<"map" | "satellite" | "hybrid">(mapStyleType);
  const [isLayersOpen, setIsLayersOpen] = useState(false);

  const [internalLayers, setInternalLayers] = useState<LayerItem[]>(layersList);
  const activeLayers = layersList || internalLayers;

  const handleToggle = (id: string) => {
    if (onToggleLayer) {
      onToggleLayer(id);
    } else {
      setInternalLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l))
      );
    }
  };

  const handleOpacity = (id: string, opacity: number) => {
    if (onLayerOpacity) {
      onLayerOpacity(id, opacity);
    } else {
      setInternalLayers((prev) =>
        prev.map((l) => (l.id === id ? { ...l, opacity } : l))
      );
    }
  };

  const geojson = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: scored.map((h) => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [h.boundary.map(([lng, lat]) => [lng, lat])],
      },
      properties: {
        h3: h.h3,
        score: h.score,
        score100: h.score100 || Math.round(h.score * 100),
        eligible: h.eligible,
        isSelected: h.h3 === selectedH3,
        color: scoreToColor(h.score),
        isHotspot: h.gi_z > 1.65,
        isUnderserved: h.underserved,
      },
    })),
  }), [scored, selectedH3]);

  function handleTypeSelect(type: "map" | "satellite" | "hybrid") {
    setActiveMapType(type);
    onStyleChange?.(type);
  }

  // Load overlay layers from backend and add to map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cityId) return;

    const loadOverlayLayers = async () => {
      try {
        const res = await fetch(`${BASE_URL}/cities/${cityId}/layers`);
        if (!res.ok) return;
        const layerNames = await res.json();
        
        for (const name of layerNames) {
          const layerConfig = activeLayers.find(l => l.id === name);
          if (!layerConfig) continue;

          try {
            const geoRes = await fetch(`${BASE_URL}/cities/${cityId}/layers/${name}`);
            if (!geoRes.ok) continue;
            const geojsonData = await geoRes.json();

            const sourceId = `overlay-${name}`;
            const layerId = `overlay-${name}-layer`;

            // Remove existing if present
            if (map.getLayer(layerId)) map.removeLayer(layerId);
            if (map.getSource(sourceId)) map.removeSource(sourceId);

            // Add source
            map.addSource(sourceId, { type: "geojson", data: geojsonData });

            // Get style config
            const style = LAYER_STYLES[name] || { type: "fill" as const, paint: { "fill-color": "#888", "fill-opacity": 0.5 } };

            // Add layer if enabled
            if (layerConfig.enabled) {
              const basePaint = { ...style.paint };
              // Only apply opacity to supported paint properties for this layer type
              if (style.type === "fill" || style.type === "circle") {
                const opacityKey = style.type === "fill" ? "fill-opacity" : "circle-opacity";
                const defaultOpacity = style.type === "fill" ? 0.5 : 0.8;
                basePaint[opacityKey] = (basePaint[opacityKey] || defaultOpacity) * (layerConfig.opacity / 100);
              } else if (style.type === "line") {
                basePaint["line-opacity"] = (basePaint["line-opacity"] || 0.8) * (layerConfig.opacity / 100);
              }

              const layerSpec = {
                id: layerId,
                type: style.type,
                source: sourceId,
                paint: basePaint,
layout: style.layout ?? {},
              } as maplibregl.AddLayerObject;
              map.addLayer(layerSpec);
            }
          } catch (e) {
            console.warn(`Failed to load layer ${name}:`, e);
          }
        }
      } catch (e) {
        console.warn("Failed to load overlay layers:", e);
      }
    };

    if (map.isStyleLoaded()) {
      loadOverlayLayers();
    } else {
      map.once("load", loadOverlayLayers);
    }
  }, [activeMapType, cityId, activeLayers]);

  // Sync layer visibility and opacity to map when activeLayers changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !cityId) return;

    const syncLayers = async () => {
      for (const layer of activeLayers) {
        const sourceId = `overlay-${layer.id}`;
        const layerId = `overlay-${layer.id}-layer`;
        const style = LAYER_STYLES[layer.id];

        if (!style) continue;

        // Skip if source doesn't exist yet (initial load effect will handle it)
        if (!map.getSource(sourceId)) continue;

        if (layer.enabled) {
          // Add or show layer
          if (!map.getLayer(layerId)) {
            const basePaint = { ...style.paint };
            if (style.type === "fill" || style.type === "circle") {
              const opacityKey = style.type === "fill" ? "fill-opacity" : "circle-opacity";
              const defaultOpacity = style.type === "fill" ? 0.5 : 0.8;
              basePaint[opacityKey] = (basePaint[opacityKey] || defaultOpacity) * (layer.opacity / 100);
            } else if (style.type === "line") {
              basePaint["line-opacity"] = (basePaint["line-opacity"] || 0.8) * (layer.opacity / 100);
            }

            const layerSpec = {
              id: layerId,
              type: style.type,
              source: sourceId,
              paint: basePaint,
              layout: style.layout,
            } as maplibregl.AddLayerObject;
            map.addLayer(layerSpec);
          } else {
            map.setLayoutProperty(layerId, "visibility", "visible");
            if (style.type === "fill" || style.type === "circle") {
              const opacityKey = style.type === "fill" ? "fill-opacity" : "circle-opacity";
              const defaultOpacity = style.type === "fill" ? 0.5 : 0.8;
              map.setPaintProperty(layerId, opacityKey, (style.paint[opacityKey] || defaultOpacity) * (layer.opacity / 100));
            } else if (style.type === "line") {
              map.setPaintProperty(layerId, "line-opacity", (style.paint["line-opacity"] || 0.8) * (layer.opacity / 100));
            }
          }
        } else {
          // Hide layer
          if (map.getLayer(layerId)) {
            map.setLayoutProperty(layerId, "visibility", "none");
          }
        }
      }
    };

    if (map.isStyleLoaded()) {
      syncLayers();
    } else {
      map.once("load", syncLayers);
    }
  }, [activeLayers, cityId]);

  useEffect(() => {
    if (!containerRef.current) return;

    const tileUrls =
      activeMapType === "satellite" || activeMapType === "hybrid"
        ? [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ]
        : [
            "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          ];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          "base-tiles": {
            type: "raster",
            tiles: tileUrls,
            tileSize: 256,
            attribution: "© OpenStreetMap contributors © CARTO",
          },
        },
        layers: [
          {
            id: "base-layer",
            type: "raster",
            source: "base-tiles",
            paint: {
              "raster-opacity": activeMapType === "satellite" ? 0.95 : 1.0,
            },
          },
        ],
      },
      center: center,
      zoom: 12.2,
      maxZoom: 16,
      minZoom: 9,
    });

    mapRef.current = map;

    map.on("load", () => {
      map.addSource("hexes", { type: "geojson", data: geojson });

      map.addLayer({
        id: "hex-fill",
        type: "fill",
        source: "hexes",
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": 0.78,
        },
      });

      map.addLayer({
        id: "hex-line",
        type: "line",
        source: "hexes",
        paint: {
          "line-color": "#ffffff",
          "line-width": 0.6,
          "line-opacity": 0.45,
        },
      });

      map.addLayer({
        id: "hex-selected-line",
        type: "line",
        source: "hexes",
        filter: ["==", ["get", "isSelected"], true],
        paint: {
          "line-color": "#16C6B5",
          "line-width": 3.5,
        },
      });

      map.on("click", "hex-fill", (e) => {
        const f = e.features?.[0];
        if (f?.properties?.['h3']) {
          onClickRef.current(f.properties['h3'] as string);
        }
      });

      map.on("mouseenter", "hex-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "hex-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      updateMarkers(map, scored, selectedH3);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [activeMapType]);

  function updateMarkers(map: maplibregl.Map, hexList: ScoredHex[], selH3: string | null) {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const topRankedHex = topSitesList[0] ?? hexList.find((h) => h.h3 === selH3);
    if (topRankedHex) {
      const el = document.createElement("div");
      el.className = "selected-marker-container";
      el.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-100%);cursor:pointer;">
          <div style="background:#063B45;color:#ffffff;font-family:sans-serif;font-size:11px;font-weight:700;padding:3px 8px;border-radius:12px;border:1px solid rgba(255,255,255,0.3);box-shadow:0 4px 12px rgba(0,0,0,0.35);display:flex;align-items:center;gap:4px;white-space:nowrap;">
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#16C6B5;"></span>
            Score ${topRankedHex.score100 || Math.round(topRankedHex.score * 100)}
          </div>
          <div style="width:20px;height:20px;background:#075E68;border:3px solid #ffffff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);margin-top:2px;"></div>
        </div>
      `;
      markersRef.current.push(
        new maplibregl.Marker({ element: el }).setLngLat(topRankedHex.center).addTo(map)
      );
    }

    const topHotspot = [...hexList].sort((a, b) => b.score - a.score)[0];
    if (topHotspot && topHotspot.h3 !== topRankedHex?.h3) {
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="background:#dc2626;color:#ffffff;font-family:sans-serif;font-size:10px;font-weight:700;padding:3px 7px;border-radius:10px;border:1.5px solid #ffffff;box-shadow:0 3px 8px rgba(220,38,38,0.4);display:flex;align-items:center;gap:3px;cursor:pointer;white-space:nowrap;transform:translateY(-50%);">
          <span>⚡ High Potential</span>
        </div>
      `;
      el.addEventListener("click", () => onClickRef.current(topHotspot.h3));
      markersRef.current.push(
        new maplibregl.Marker({ element: el }).setLngLat(topHotspot.center).addTo(map)
      );
    }

    const underservedHex = hexList.find((h) => h.underserved);
    if (underservedHex && underservedHex.h3 !== topRankedHex?.h3 && underservedHex.h3 !== topHotspot?.h3) {
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="background:#581c87;color:#f3e8ff;font-family:sans-serif;font-size:10px;font-weight:700;padding:3px 7px;border-radius:10px;border:1.5px solid #c084fc;box-shadow:0 3px 8px rgba(88,28,135,0.4);display:flex;align-items:center;gap:3px;cursor:pointer;white-space:nowrap;transform:translateY(-50%);">
          <span>Underserved Area</span>
        </div>
      `;
      el.addEventListener("click", () => onClickRef.current(underservedHex.h3));
      markersRef.current.push(
        new maplibregl.Marker({ element: el }).setLngLat(underservedHex.center).addTo(map)
      );
    }

    competitors.slice(0, 10).forEach((c) => {
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="width:18px;height:18px;background:#0f172a;border:1.5px solid #ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#38bdf8;font-size:9px;box-shadow:0 2px 6px rgba(0,0,0,0.3);" title="${c.name}">
          ⚡
        </div>
      `;
      markersRef.current.push(
        new maplibregl.Marker({ element: el }).setLngLat(c.lngLat).addTo(map)
      );
    });
  }

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyUpdate = () => {
      const src = map.getSource("hexes") as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(geojson);
      updateMarkers(map, scored, selectedH3);
    };

    if (map.isStyleLoaded()) {
      applyUpdate();
    } else {
      map.once("load", applyUpdate);
    }
  }, [geojson, scored, selectedH3, topSitesList]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center, zoom: 12.2, duration: 1500 });
    }
  }, [center[0], center[1]]);

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();
  const recenter = () => mapRef.current?.flyTo({ center, zoom: 12.2 });

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-[#04232a]">
      <div ref={containerRef} id="hex-map-canvas" className="w-full h-full" />

      {/* Top Left: Map Style Switcher + Layers Button */}
      <div className="absolute top-3.5 left-3.5 z-10 flex items-center gap-2">
        <div className="flex bg-white/95 backdrop-blur-md rounded-xl p-1 border border-slate-200/90 shadow-sm text-xs font-semibold text-slate-700">
          {(["map", "satellite", "hybrid"] as const).map((type) => (
            <button
              key={type}
              onClick={() => handleTypeSelect(type)}
              className={`px-3 py-1 rounded-lg capitalize transition-all ${
                activeMapType === type
                  ? "bg-[#063B45] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Floating Layers Button */}
        <button
          onClick={() => setIsLayersOpen(!isLayersOpen)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm ${
            isLayersOpen
              ? "bg-[#063B45] text-white border-[#063B45]"
              : "bg-white/95 backdrop-blur-md border-slate-200/90 text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Layers</span>
          <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-[#e0f7f5] text-[#063B45] text-[10px] font-mono">
            {activeLayers.filter((l) => l.enabled).length}
          </span>
        </button>
      </div>

      {/* Interactive Map Layers Panel (Requirement 5) */}
      <MapLayersPanel
        isOpen={isLayersOpen}
        layers={activeLayers}
        onToggleLayer={handleToggle}
        onOpacityChange={handleOpacity}
        onClose={() => setIsLayersOpen(false)}
      />

      {/* Top Right: Score Gradient Color Legend Pill */}
      <div className="absolute top-3.5 right-3.5 z-10 bg-white/95 backdrop-blur-md rounded-xl px-3.5 py-2 border border-slate-200/90 shadow-sm flex flex-col gap-1 text-slate-800">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
          Site Readiness Score
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-600">0 (Low)</span>
          <div
            className="w-28 h-2 rounded-full shadow-inner"
            style={{
              background: "linear-gradient(90deg, #3b82f6 0%, #10b981 35%, #f59e0b 70%, #ef4444 100%)",
            }}
          />
          <span className="text-[10px] font-bold text-slate-600">100 (High)</span>
        </div>
      </div>

      {/* Right Floating Map Controls: Zoom In / Out / Recenter */}
      <div className="absolute right-3.5 top-20 z-10 flex flex-col gap-1 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200/90 shadow-sm p-1 text-slate-700">
        <button
          onClick={zoomIn}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={zoomOut}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="h-px bg-slate-200 my-0.5" />
        <button
          onClick={recenter}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-[#075E68]"
          title="Recenter Map"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Right: Map Layer Items Legend */}
      <div className="absolute bottom-3.5 right-3.5 z-10 bg-white/95 backdrop-blur-md rounded-xl p-2.5 border border-slate-200/90 shadow-sm text-[10px] font-medium text-slate-700 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#075E68] border-2 border-white shadow" />
          <span>Selected Location</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>High Potential Area</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-700" />
          <span>Underserved Area</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-slate-900 text-sky-400 text-[8px] flex items-center justify-center font-bold">
            ⚡
          </div>
          <span>Competitor / POI</span>
        </div>
      </div>
    </div>
  );
}