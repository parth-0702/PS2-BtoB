import { useState } from "react";
import { Layers, Eye, EyeOff, AlertTriangle } from "lucide-react";

export interface LayerConfig {
  id: string;
  label: string;
  coverage: number;
  synthetic: boolean;
  source: string;
  visible: boolean;
  opacity: number;
}

interface LayerPanelProps {
  layers: LayerConfig[];
  onToggle: (id: string) => void;
  onOpacity: (id: string, opacity: number) => void;
}

const LAYER_ICONS: Record<string, string> = {
  population: "👥",
  transportation: "🚗",
  pois: "📍",
  landuse: "🏗️",
  risk: "⚠️",
};

export function LayerPanel({ layers, onToggle, onOpacity }: LayerPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <Layers size={15} className="text-amber-400" />
        <span className="text-sm font-semibold text-white">Data Layers</span>
      </div>

      {layers.map((layer) => (
        <div
          key={layer.id}
          className={`rounded-lg border transition-all ${
            layer.visible
              ? "border-slate-600/50 bg-slate-700/30"
              : "border-slate-700/30 bg-slate-800/20"
          }`}
        >
          {/* Layer row */}
          <div
            className="flex items-center gap-2 p-2 cursor-pointer"
            onClick={() => setExpanded(expanded === layer.id ? null : layer.id)}
          >
            <span className="text-base">{LAYER_ICONS[layer.id] ?? "📊"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className={`text-xs truncate ${layer.visible ? "text-white" : "text-slate-500"}`}>
                  {layer.label}
                </span>
                {layer.synthetic && (
                  <span title="Synthetic data" className="flex items-center flex-shrink-0">
                    <AlertTriangle size={9} className="text-amber-400" />
                  </span>
                )}
              </div>
              {/* Coverage bar */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex-1 h-1 rounded-full bg-slate-700">
                  <div
                    className="h-full rounded-full bg-emerald-500/70 transition-all"
                    style={{ width: `${layer.coverage * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{(layer.coverage * 100).toFixed(0)}%</span>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(layer.id); }}
              className={`p-1 rounded transition-colors ${
                layer.visible ? "text-emerald-400 hover:text-emerald-300" : "text-slate-600 hover:text-slate-400"
              }`}
            >
              {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
          </div>

          {/* Expanded: opacity + source */}
          {expanded === layer.id && (
            <div className="px-2 pb-2 border-t border-slate-700/30 pt-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-12">Opacity</span>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={layer.opacity}
                  onChange={(e) => onOpacity(layer.id, parseFloat(e.target.value))}
                  className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "#10b981" }}
                />
                <span className="text-[10px] font-mono text-slate-300 w-8 text-right">
                  {(layer.opacity * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-[10px] text-slate-500 italic">{layer.source}</p>
            </div>
          )}
        </div>
      ))}

      {/* Synthetic disclaimer */}
      <div className="flex items-start gap-1.5 mt-1 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
        <AlertTriangle size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-300/70 leading-relaxed">
          Layers marked ⚠️ use synthetic data generated for demonstration. Replace with real OSM/WorldPop data in production.
        </p>
      </div>
    </div>
  );
}

export function defaultLayers(): LayerConfig[] {
  return [
    { id: "population", label: "Population & Demographics", coverage: 0.97, synthetic: true, source: "Synthetic census proxy", visible: true, opacity: 0.8 },
    { id: "transportation", label: "Transportation", coverage: 0.95, synthetic: true, source: "Synthetic road/transit graph", visible: true, opacity: 0.8 },
    { id: "pois", label: "Points of Interest", coverage: 0.89, synthetic: true, source: "Synthetic POI dataset", visible: true, opacity: 0.8 },
    { id: "landuse", label: "Land Use & Zoning", coverage: 0.93, synthetic: true, source: "Synthetic zoning", visible: true, opacity: 0.8 },
    { id: "risk", label: "Environmental & Risk", coverage: 0.72, synthetic: true, source: "Synthetic flood/AQI", visible: true, opacity: 0.8 },
  ];
}
