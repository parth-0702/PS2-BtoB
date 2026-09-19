import { useState } from "react";
import {
  Layers, X, Users, Route, Store, ShieldAlert, Compass, Building2, Upload
} from "lucide-react";

export interface LayerItem {
  id: string;
  name: string;
  enabled: boolean;
  opacity: number;
  coverage: string;
  isSynthetic?: boolean;
  icon: React.ReactNode;
}

interface MapLayersPanelProps {
  isOpen: boolean;
  layers: LayerItem[];
  onToggleLayer: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  onClose: () => void;
}

export function MapLayersPanel({
  isOpen,
  layers,
  onToggleLayer,
  onOpacityChange,
  onClose,
}: MapLayersPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute top-14 left-3.5 z-20 w-72 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl p-3.5 animate-in fade-in zoom-in-95 duration-150 select-none text-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2.5">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-[#064e3b]" />
          <span className="text-xs font-bold text-slate-900">Geospatial Data Layers</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Layers List */}
      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {layers.map((layer) => (
          <div key={layer.id} className="bg-slate-50/80 p-2 rounded-xl border border-slate-200/70 space-y-1.5">
            {/* Toggle Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-slate-600">{layer.icon}</div>
                <div>
                  <div className="text-xs font-semibold text-slate-800">{layer.name}</div>
                  <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
                    <span>{layer.coverage}</span>
                    {layer.isSynthetic && (
                      <span className="text-amber-600 bg-amber-50 px-1 rounded border border-amber-200">
                        synthetic
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* On/Off Switch */}
              <div
                onClick={() => onToggleLayer(layer.id)}
                className={`w-7 h-4 rounded-full flex items-center p-0.5 cursor-pointer transition-colors ${
                  layer.enabled ? "bg-[#059669] justify-end" : "bg-slate-300 justify-start"
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
              </div>
            </div>

            {/* Opacity Slider ONLY shown when layer is switched on */}
            {layer.enabled && (
              <div className="flex items-center gap-2 pt-1 border-t border-slate-200/50 animate-in fade-in">
                <span className="text-[10px] text-slate-400 font-mono">Opacity</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={layer.opacity}
                  onChange={(e) => onOpacityChange(layer.id, parseInt(e.target.value))}
                  className="flex-1 h-1 rounded-full appearance-none bg-slate-200 accent-[#059669] cursor-pointer"
                />
                <span className="text-[10px] font-mono text-slate-600 w-6 text-right">
                  {layer.opacity}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Upload Custom Layer Trigger */}
      <div className="pt-2 mt-2 border-t border-slate-100">
        <button
          onClick={() => alert("Select a GeoJSON, GeoTIFF, Shapefile or WKT file to upload as a custom layer.")}
          className="w-full py-1.5 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <Upload className="w-3 h-3" />
          <span>Upload Custom Layer</span>
        </button>
      </div>
    </div>
  );
}
