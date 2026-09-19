import { useState, useEffect, useRef } from "react";
import {
  X, RotateCcw, ChevronDown, ChevronUp, SlidersHorizontal,
  ShieldAlert, Check, Plus, Trash2, Info
} from "lucide-react";
import type { FactorWeights } from "@/lib/sitescope/store";

export interface DrawerConfig {
  weights: FactorWeights;
  decayType: "exponential" | "gaussian" | "linear";
  decayD0Km: number;
  competitionMode: "penalise" | "cluster_bonus";
  competitionRadiusKm: number;
  competitionSaturation: number;
  constraints: string[];
}

interface AdjustWeightsDrawerProps {
  isOpen: boolean;
  initialConfig: DrawerConfig;
  baseConfig: DrawerConfig;
  onApply: (newConfig: DrawerConfig) => void;
  onLivePreview: (config: DrawerConfig) => void;
  onClose: () => void;
}

const FACTOR_INFO: Record<keyof FactorWeights, { label: string; color: string; desc: string }> = {
  demand: { label: "Demand (Population & Footfall)", color: "#3b82f6", desc: "Density of customers & pedestrian mobility" },
  accessibility: { label: "Accessibility (Roads & Transit)", color: "#10b981", desc: "Arterial road connectivity & travel speed" },
  complementary: { label: "Complementary POIs", color: "#8b5cf6", desc: "Anchor businesses & crowd magnets" },
  competition: { label: "Competition Tolerance", color: "#f59e0b", desc: "Direct rival proximity & saturation" },
  landuse: { label: "Land Suitability", color: "#ec4899", desc: "Commercial & mixed zoning suitability" },
  risk: { label: "Risk (Flood & Environment)", color: "#06b6d4", desc: "Flood hazard & environmental safety" },
};

const AVAILABLE_CONSTRAINTS = [
  { id: "no_flood", label: "No flood zones" },
  { id: "ground_floor_commercial", label: "Commercial zones only" },
  { id: "needs_parking", label: "Adequate parking required" },
  { id: "max_rent", label: "Below median rent" },
  { id: "no_industrial", label: "Exclude industrial land" },
];

export function AdjustWeightsDrawer({
  isOpen,
  initialConfig,
  baseConfig,
  onApply,
  onLivePreview,
  onClose,
}: AdjustWeightsDrawerProps) {
  const [draft, setDraft] = useState<DrawerConfig>(initialConfig);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync draft when opened
  useEffect(() => {
    if (isOpen) {
      setDraft(initialConfig);
    }
  }, [isOpen, initialConfig]);

  // Live re-scoring with 200 ms debounce
  useEffect(() => {
    if (!isOpen) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onLivePreview(draft);
    }, 200);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [draft, isOpen, onLivePreview]);

  // Proportional Auto-Balancing Slider Handler
  const handleWeightChange = (factor: keyof FactorWeights, newValue: number) => {
    const clampedNew = Math.max(0, Math.min(90, Math.round(newValue)));
    const oldWeights = draft.weights;
    const remaining = 100 - clampedNew;

    const otherKeys = (Object.keys(oldWeights) as (keyof FactorWeights)[]).filter(
      (k) => k !== factor
    );
    const sumOthers = otherKeys.reduce((acc, k) => acc + oldWeights[k], 0);

    const newWeights: FactorWeights = { ...oldWeights, [factor]: clampedNew };

    if (sumOthers > 0) {
      let allocated = 0;
      otherKeys.forEach((k, idx) => {
        if (idx === otherKeys.length - 1) {
          // Put remainder into last factor to guarantee exact sum = 100
          newWeights[k] = Math.max(0, remaining - allocated);
        } else {
          const scaled = Math.max(0, Math.round((oldWeights[k] / sumOthers) * remaining));
          newWeights[k] = scaled;
          allocated += scaled;
        }
      });
    } else {
      // If others were all zero, distribute equally
      const perItem = Math.floor(remaining / otherKeys.length);
      otherKeys.forEach((k, idx) => {
        newWeights[k] = idx === otherKeys.length - 1 ? remaining - perItem * (otherKeys.length - 1) : perItem;
      });
    }

    setDraft((prev) => ({ ...prev, weights: newWeights }));
  };

  const handleResetToMyAnswers = () => {
    setDraft(baseConfig);
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleCancel = () => {
    onLivePreview(initialConfig);
    onClose();
  };

  const toggleConstraint = (cid: string) => {
    setDraft((prev) => {
      const exists = prev.constraints.includes(cid);
      const next = exists ? prev.constraints.filter((x) => x !== cid) : [...prev.constraints, cid];
      return { ...prev, constraints: next };
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in select-none">
      <div className="w-full max-w-md bg-white text-slate-800 h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#064e3b] text-white flex items-center justify-center shadow-xs">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Adjust Scoring Weights</h2>
              <p className="text-[10px] text-slate-500 font-mono">Auto-balances to 100% total</p>
            </div>
          </div>

          <button
            onClick={handleCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Sliders Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Factor Sliders */}
          <div className="space-y-3.5">
            {(Object.keys(draft.weights) as (keyof FactorWeights)[]).map((key) => {
              const val = draft.weights[key];
              const info = FACTOR_INFO[key];
              return (
                <div key={key} className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{info.label}</span>
                      <div className="text-[10px] text-slate-400">{info.desc}</div>
                    </div>
                    <span
                      className="font-mono font-extrabold text-sm px-2 py-0.5 rounded-md"
                      style={{ color: info.color, backgroundColor: `${info.color}15` }}
                    >
                      {val}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={90}
                    step={1}
                    value={val}
                    onChange={(e) => handleWeightChange(key, parseInt(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none bg-slate-200 cursor-pointer"
                    style={{
                      accentColor: info.color,
                      background: `linear-gradient(to right, ${info.color} ${val}%, #e2e8f0 ${val}%)`,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Advanced Accordion Toggle */}
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full py-2 text-xs font-bold text-slate-700 hover:text-[#064e3b] transition-colors"
            >
              <span>Advanced Parameters & Constraints</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="pt-2 space-y-3.5 text-xs">
                {/* Distance Decay */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <label className="font-bold text-slate-800 block">Distance Decay Function</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(["exponential", "gaussian", "linear"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setDraft((p) => ({ ...p, decayType: t }))}
                        className={`py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
                          draft.decayType === t
                            ? "bg-[#064e3b] text-white border-[#064e3b]"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Decay Reach d₀:</span>
                      <span className="font-mono font-bold text-slate-900">{draft.decayD0Km.toFixed(1)} km</span>
                    </div>
                    <input
                      type="range"
                      min={0.3}
                      max={8.0}
                      step={0.1}
                      value={draft.decayD0Km}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, decayD0Km: parseFloat(e.target.value) }))
                      }
                      className="w-full h-1.5 rounded-full appearance-none bg-slate-200 accent-[#064e3b] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Competition Policy */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <label className="font-bold text-slate-800 block">Competition Mode</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => setDraft((p) => ({ ...p, competitionMode: "penalise" }))}
                      className={`py-1.5 rounded-lg text-xs font-semibold border ${
                        draft.competitionMode === "penalise"
                          ? "bg-[#064e3b] text-white border-[#064e3b]"
                          : "bg-white border-slate-200 text-slate-600"
                      }`}
                    >
                      Penalize Rivals
                    </button>
                    <button
                      onClick={() => setDraft((p) => ({ ...p, competitionMode: "cluster_bonus" }))}
                      className={`py-1.5 rounded-lg text-xs font-semibold border ${
                        draft.competitionMode === "cluster_bonus"
                          ? "bg-[#064e3b] text-white border-[#064e3b]"
                          : "bg-white border-slate-200 text-slate-600"
                      }`}
                    >
                      Cluster Synergy
                    </button>
                  </div>
                </div>

                {/* Threshold Constraints */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <label className="font-bold text-slate-800 block">Threshold Hard Constraints</label>
                  <div className="space-y-1.5">
                    {AVAILABLE_CONSTRAINTS.map((c) => {
                      const isChecked = draft.constraints.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleConstraint(c.id)}
                          className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-emerald-50 border-emerald-300 text-[#064e3b] font-semibold"
                              : "bg-white border-slate-200 text-slate-600"
                          }`}
                        >
                          <span className="text-xs">{c.label}</span>
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center ${
                              isChecked ? "bg-[#059669] text-white" : "border border-slate-300"
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Drawer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleResetToMyAnswers}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to my answers</span>
            </button>

            <button
              onClick={handleCancel}
              className="py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>

          <button
            onClick={handleApply}
            className="w-full py-3 rounded-xl bg-[#064e3b] hover:bg-[#047857] text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Apply Weights & Update Map</span>
          </button>
        </div>
      </div>
    </div>
  );
}
