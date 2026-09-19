import { useState } from "react";
import { SlidersHorizontal, Edit3, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import type { FactorWeights } from "@/lib/sitescope/store";

interface PriorityCardProps {
  weights: FactorWeights;
  constraints: string[];
  isCustomized: boolean;
  onAdjustWeights: () => void;
  onEditAnswers: () => void;
}

const LABELS: Record<keyof FactorWeights, { label: string; short: string }> = {
  demand:        { label: "Demand",          short: "Demand" },
  accessibility: { label: "Accessibility",   short: "Accessibility" },
  complementary: { label: "Complementary",   short: "Complementary" },
  competition:   { label: "Competition",     short: "Competition" },
  landuse:       { label: "Land Suitability",short: "Land Suitability" },
  risk:          { label: "Risk",            short: "Risk" },
};

function getStrengthLabel(val: number): { label: string; color: string; bg: string; bar: string } {
  if (val >= 25) return { label: "High",   color: "#065f46", bg: "#ecfdf5", bar: "#059669" };
  if (val >= 15) return { label: "Medium", color: "#92400e", bg: "#fffbeb", bar: "#d97706" };
  return            { label: "Low",    color: "#374151", bg: "#f9fafb", bar: "#94a3b8" };
}

function formatConstraint(c: string): string {
  if (c === "no_flood") return "No flood zones";
  if (c === "ground_floor_commercial") return "Commercial zone";
  if (c === "parking_required") return "Parking required";
  return c.replace(/_/g, " ");
}

export function PriorityCard({
  weights,
  constraints,
  isCustomized,
  onAdjustWeights,
  onEditAnswers,
}: PriorityCardProps) {
  const [showAllConstraints, setShowAllConstraints] = useState(false);

  const sortedFactors = (Object.keys(weights) as (keyof FactorWeights)[])
    .map((key) => ({
      key,
      val: weights[key] ?? 0,
      label: LABELS[key]?.label ?? key,
      short: LABELS[key]?.short ?? key,
    }))
    .sort((a, b) => b.val - a.val);

  const visibleConstraints = showAllConstraints ? constraints : constraints.slice(0, 1);
  const extraCount = constraints.length - 1;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-bold text-slate-800">Your Analysis</span>
        </div>
        {isCustomized ? (
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
            Customized
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-[#e0f7f5] text-[#063B45] border border-[#b2eceb] text-[10px] font-bold">
            From Wizard
          </span>
        )}
      </div>

      {/* Priority Factors — High / Medium / Low */}
      <div className="px-4 py-3 space-y-1.5">
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          Priority Factors
        </div>
        {sortedFactors.map((f) => {
          const strength = getStrengthLabel(f.val);
          const barWidth = Math.round((f.val / 40) * 100);
          return (
            <div key={f.key} className="flex items-center gap-2">
              <span className="flex-1 text-[11px] text-slate-700 font-medium truncate">
                {f.short}
              </span>
              <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, barWidth)}%`, backgroundColor: strength.bar }}
                />
              </div>
              <span
                className="text-[10px] font-bold w-12 text-right flex-shrink-0"
                style={{ color: strength.color }}
              >
                {strength.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Active Constraints — compact */}
      {constraints.length > 0 && (
        <div className="px-4 pb-3 border-t border-slate-100 pt-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Constraints
          </div>
          <div className="flex flex-wrap gap-1 items-center">
            {visibleConstraints.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 text-slate-600 text-[11px] font-medium border border-slate-200"
              >
                <ShieldAlert className="w-2.5 h-2.5 text-amber-500" />
                {formatConstraint(c)}
              </span>
            ))}
            {!showAllConstraints && extraCount > 0 && (
              <button
                onClick={() => setShowAllConstraints(true)}
                className="text-[11px] text-[#059669] font-semibold hover:underline flex items-center gap-0.5"
              >
                +{extraCount} more <ChevronDown className="w-3 h-3" />
              </button>
            )}
            {showAllConstraints && constraints.length > 1 && (
              <button
                onClick={() => setShowAllConstraints(false)}
                className="text-[11px] text-slate-400 font-semibold hover:underline flex items-center gap-0.5"
              >
                Show less <ChevronUp className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
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
