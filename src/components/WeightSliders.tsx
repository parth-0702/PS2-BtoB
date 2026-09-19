import { useState, useCallback } from "react";
import { SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

export interface Weights {
  demand: number;
  accessibility: number;
  complementary: number;
  competition: number;
  landuse: number;
  risk: number;
}

export interface DecayConfig {
  type: "exponential" | "gaussian" | "linear";
  d0_km: number;
}

export interface CompetitionConfig {
  mode: "penalise" | "cluster_bonus";
  radius_km: number;
  saturation: number;
}

interface WeightSlidersProps {
  weights: Weights;
  decay: DecayConfig;
  competition: CompetitionConfig;
  onWeightsChange: (w: Weights) => void;
  onDecayChange: (d: DecayConfig) => void;
  onCompetitionChange: (c: CompetitionConfig) => void;
}

const LABELS: Record<keyof Weights, string> = {
  demand: "🧑‍🤝‍🧑 Demand",
  accessibility: "🚗 Accessibility",
  complementary: "🏪 Complementary",
  competition: "⚔️ Competition",
  landuse: "🏗️ Land Use",
  risk: "🛡️ Risk",
};

const COLORS: Record<keyof Weights, string> = {
  demand: "#3b82f6",
  accessibility: "#10b981",
  complementary: "#8b5cf6",
  competition: "#f59e0b",
  landuse: "#ec4899",
  risk: "#06b6d4",
};

const DEFAULT_WEIGHTS: Weights = {
  demand: 25, accessibility: 20, complementary: 15,
  competition: 20, landuse: 10, risk: 10,
};

export function WeightSliders({
  weights,
  decay,
  competition,
  onWeightsChange,
  onDecayChange,
  onCompetitionChange,
}: WeightSlidersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  const setWeight = useCallback((key: keyof Weights, val: number) => {
    onWeightsChange({ ...weights, [key]: val });
  }, [weights, onWeightsChange]);

  const reset = () => {
    onWeightsChange(DEFAULT_WEIGHTS);
    onDecayChange({ type: "exponential", d0_km: 1.0 });
    onCompetitionChange({ mode: "penalise", radius_km: 1.0, saturation: 5 });
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={15} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Scoring Weights</span>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
          title="Reset to defaults"
        >
          <RotateCcw size={11} />
          Reset
        </button>
      </div>

      {/* Total indicator */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
          {(Object.keys(weights) as (keyof Weights)[]).map((k) => (
            <div
              key={k}
              className="h-full float-left transition-all duration-200"
              style={{
                width: `${(weights[k] / total) * 100}%`,
                background: COLORS[k],
              }}
            />
          ))}
        </div>
        <span>Σ={total}</span>
      </div>

      {/* Sliders */}
      {(Object.keys(weights) as (keyof Weights)[]).map((key) => (
        <div key={key} className="flex flex-col gap-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300">{LABELS[key]}</span>
            <span className="font-mono text-white">{weights[key]}</span>
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={weights[key]}
            onChange={(e) => setWeight(key, parseInt(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{
              accentColor: COLORS[key],
              background: `linear-gradient(to right, ${COLORS[key]} ${(weights[key] / 50) * 100}%, #374151 ${(weights[key] / 50) * 100}%)`,
            }}
          />
        </div>
      ))}

      {/* Advanced toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white pt-1 border-t border-slate-700/50 mt-1 transition-colors"
      >
        <span>Advanced settings</span>
        {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-3 pt-1">
          {/* Decay type */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Distance Decay</label>
            <div className="flex gap-1">
              {(["exponential", "gaussian", "linear"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onDecayChange({ ...decay, type: t })}
                  className={`flex-1 text-[10px] py-1 rounded transition-all ${
                    decay.type === t
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:bg-slate-600/50"
                  }`}
                >
                  {t.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* d0 */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Decay d₀ (km)</span>
              <span className="font-mono text-white">{decay.d0_km.toFixed(1)}</span>
            </div>
            <input
              type="range" min={0.2} max={10} step={0.1}
              value={decay.d0_km}
              onChange={(e) => onDecayChange({ ...decay, d0_km: parseFloat(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "#f59e0b" }}
            />
          </div>

          {/* Competition mode */}
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Competition Mode</label>
            <div className="flex gap-1">
              {(["penalise", "cluster_bonus"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onCompetitionChange({ ...competition, mode: m })}
                  className={`flex-1 text-[10px] py-1 rounded transition-all ${
                    competition.mode === m
                      ? "bg-red-500/20 text-red-300 border border-red-500/40"
                      : "bg-slate-700/50 text-slate-400 border border-slate-600/30 hover:bg-slate-600/50"
                  }`}
                >
                  {m === "penalise" ? "Penalise" : "Cluster"}
                </button>
              ))}
            </div>
          </div>

          {/* Saturation */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Saturation threshold</span>
              <span className="font-mono text-white">{competition.saturation}</span>
            </div>
            <input
              type="range" min={1} max={20} step={1}
              value={competition.saturation}
              onChange={(e) => onCompetitionChange({ ...competition, saturation: parseInt(e.target.value) })}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "#ef4444" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
