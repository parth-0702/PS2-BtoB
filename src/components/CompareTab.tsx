import { useState, useEffect } from "react";
import { X, GitCompare, Star } from "lucide-react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, Tooltip,
} from "recharts";
import type { ScoredHex } from "@/lib/sitescope/scoring";
import { compareSites } from "@/lib/api";

interface CompareTabProps {
  candidates: ScoredHex[];
  onRemove: (h3: string) => void;
  business: string;
}

const SUB_LABELS: Record<string, string> = {
  demand: "Demand",
  accessibility: "Access",
  complementary: "Nearby",
  competition: "Competition",
  landuse: "Land Use",
  risk: "Risk",
};

const COLORS = ["#3b82f6", "#f59e0b", "#10b981"];
const LOCATION_NAMES = ["Vesu", "Adajan", "Pal", "Udhna", "Dumas", "Katargam", "Varachha", "Piplod"];

export function CompareTab({ candidates, onRemove, business }: CompareTabProps) {
  const [aiRec, setAiRec] = useState<{ recommendation: string; winner: number; source: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (candidates.length < 2) { setAiRec(null); return; }
    setLoading(true);
    const sites = candidates.map((h) => ({
      h3: h.h3,
      score: h.score100 || Math.round(h.score * 100),
      ...Object.fromEntries(
        Object.entries(h.subscores).map(([k, v]) => [`sub_${k}`, v])
      ),
    }));
    compareSites(sites, business)
      .then((res) => {
        setAiRec(res as any);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [candidates.length, business]);

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4 py-8">
        <GitCompare size={36} className="text-slate-400" />
        <p className="text-slate-500 text-sm">Select top locations to compare up to 3 sites.</p>
      </div>
    );
  }

  // Build radar data
  const radarData = Object.keys(SUB_LABELS).map((key) => ({
    subject: SUB_LABELS[key],
    ...Object.fromEntries(
      candidates.map((h, i) => [`site${i + 1}`, Math.round(h.subscores[key] ?? 0)])
    ),
  }));

  const getSiteName = (i: number) => LOCATION_NAMES[i % LOCATION_NAMES.length];

  // Fallback recommendation
  const bestSite = candidates.reduce((prev, curr) =>
    (curr.score100 || Math.round(curr.score * 100)) > (prev.score100 || Math.round(prev.score * 100)) ? curr : prev
  , candidates[0]!);
  const bestIndex = candidates.indexOf(bestSite);
  const bestName = getSiteName(bestIndex);
  const bestScore = bestSite.score100 || Math.round(bestSite.score * 100);

  const fallbackText = `Site ${bestIndex + 1} (${bestName}) is the top recommended location with an overall readiness score of ${bestScore}/100, showing strong demand profile and land suitability for ${business}.`;

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto p-1 font-sans">
      {/* Radar chart */}
      <div className="h-52 w-full bg-slate-50/50 rounded-2xl p-2 border border-slate-100">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} />
            {candidates.map((_, i) => (
              <Radar
                key={i}
                name={`Site ${i + 1} (${getSiteName(i)})`}
                dataKey={`site${i + 1}`}
                stroke={COLORS[i]}
                fill={COLORS[i]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
            <Tooltip
              contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 11, boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
              labelStyle={{ color: "#0f172a", fontWeight: "bold" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score table */}
      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              <th className="text-left text-slate-500 py-2 px-3 font-semibold">Factor</th>
              {candidates.map((_, i) => (
                <th key={i} className="py-2 px-3 font-bold text-right" style={{ color: COLORS[i] }}>
                  Site {i + 1} ({getSiteName(i)})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 bg-slate-50/30">
              <td className="py-2 px-3 text-slate-900 font-bold">Total Score</td>
              {candidates.map((h, i) => {
                const s = h.score100 || Math.round(h.score * 100);
                return (
                  <td key={i} className="py-2 px-3 text-right font-extrabold text-sm" style={{ color: COLORS[i] }}>
                    {s}
                  </td>
                );
              })}
            </tr>
            {Object.entries(SUB_LABELS).map(([key, label]) => (
              <tr key={key} className="border-b border-slate-100/60 hover:bg-slate-50/50">
                <td className="py-1.5 px-3 text-slate-600 font-medium">{label}</td>
                {candidates.map((h, i) => (
                  <td key={i} className="py-1.5 px-3 text-right text-slate-800 font-semibold">
                    {Math.round(h.subscores[key] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Remove chips */}
      <div className="flex flex-wrap gap-2">
        {candidates.map((h, i) => (
          <div
            key={h.h3}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold"
            style={{ borderColor: COLORS[i] + "40", color: COLORS[i], backgroundColor: COLORS[i] + "0D" }}
          >
            <span>Site {i + 1} ({getSiteName(i)})</span>
            <span className="text-[10px] opacity-70 font-mono">({h.score100 || Math.round(h.score * 100)})</span>
            <button onClick={() => onRemove(h.h3)} className="hover:opacity-70 cursor-pointer ml-0.5">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* AI recommendation */}
      {candidates.length >= 2 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Star size={13} className="text-amber-500 fill-amber-500" />
            <span className="text-xs font-bold text-emerald-900">AI Location Recommendation</span>
            {(aiRec as any)?.source && (
              <span className="text-[9px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-mono ml-auto">
                {(aiRec as any).source}
              </span>
            )}
          </div>
          {loading ? (
            <div className="h-3 w-48 bg-emerald-100 rounded animate-pulse" />
          ) : (
            <p className="text-xs text-slate-700 leading-relaxed">
              {(aiRec as any)?.recommendation || fallbackText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
