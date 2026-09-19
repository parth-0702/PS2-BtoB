import { SlidersHorizontal, Edit3, ShieldAlert, Sparkles } from "lucide-react";
import type { FactorWeights } from "@/lib/sitescope/store";

interface PriorityCardProps {
  weights: FactorWeights;
  constraints: string[];
  isCustomized: boolean;
  onAdjustWeights: () => void;
  onEditAnswers: () => void;
}

const LABELS: Record<keyof FactorWeights, { label: string; color: string }> = {
  demand: { label: "Demand (Population)", color: "#3b82f6" },
  accessibility: { label: "Accessibility (Transport)", color: "#10b981" },
  complementary: { label: "Complementary POIs", color: "#8b5cf6" },
  competition: { label: "Competition", color: "#f59e0b" },
  landuse: { label: "Land Suitability", color: "#ec4899" },
  risk: { label: "Risk (Flood & Env)", color: "#06b6d4" },
};

export function PriorityCard({
  weights,
  constraints,
  isCustomized,
  onAdjustWeights,
  onEditAnswers,
}: PriorityCardProps) {
  // Sort weights high to low
  const sortedFactors = (Object.keys(weights) as (keyof FactorWeights)[])
    .map((key) => ({
      key,
      val: weights[key] ?? 0,
      label: LABELS[key]?.label ?? key,
      color: LABELS[key]?.color ?? "#64748b",
    }))
    .sort((a, b) => b.val - a.val);

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-700" />
          <span className="text-xs font-bold text-slate-900">Your Priorities</span>
        </div>

        {isCustomized ? (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold font-mono">
            Customized
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-[#e0f7f5] text-[#063B45] border border-[#b2eceb] text-[10px] font-bold font-mono">
            From Wizard
          </span>
        )}
      </div>

      {/* Sorted Read-Only Factor Bars */}
      <div className="space-y-2">
        {sortedFactors.map((f) => (
          <div key={f.key} className="space-y-0.5">
            <div className="flex justify-between items-center text-[11px] text-slate-700">
              <span className="truncate max-w-[170px] font-medium">{f.label}</span>
              <span className="font-mono font-bold text-slate-900">{f.val}%</span>
            </div>
            {/* Small horizontal bar */}
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, f.val * 2)}%`, backgroundColor: f.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Active Constraints as Chips */}
      {constraints.length > 0 && (
        <div className="pt-2 border-t border-slate-100 space-y-1.5">
          <div className="text-[10px] font-bold uppercase text-slate-400 font-mono">
            Active Constraints
          </div>
          <div className="flex flex-wrap gap-1">
            {constraints.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200"
              >
                <ShieldAlert className="w-2.5 h-2.5 text-amber-600" />
                {c === "no_flood" ? "No flood zones" : c === "ground_floor_commercial" ? "Commercial zone" : c.replace("_", " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons: Adjust weights & Edit answers */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={onAdjustWeights}
          className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-[#063B45] hover:bg-[#075E68] text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>Adjust weights</span>
        </button>

        <button
          onClick={onEditAnswers}
          className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors"
        >
          <Edit3 className="w-3 h-3 text-slate-500" />
          <span>Edit answers</span>
        </button>
      </div>
    </div>
  );
}
