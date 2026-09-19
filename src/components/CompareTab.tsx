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

export function CompareTab({ candidates, onRemove, business }: CompareTabProps) {
  const [aiRec, setAiRec] = useState<{ recommendation: string; winner: number; source: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (candidates.length < 2) { setAiRec(null); return; }
    setLoading(true);
    const sites = candidates.map((h) => ({
      h3: h.h3,
      score: h.score,
      ...Object.fromEntries(
        Object.entries(h.subscores).map(([k, v]) => [`sub_${k}`, v])
      ),
    }));
    compareSites(sites, business).then((res) => {
      setAiRec(res as any);
      setLoading(false);
    });
  }, [candidates.length, business]);

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
        <GitCompare size={36} className="text-slate-600" />
        <p className="text-slate-400 text-sm">Click "Add to Compare" on any hex detail panel to compare up to 3 sites.</p>
      </div>
    );
  }

  // Build radar data
  const radarData = Object.keys(SUB_LABELS).map((key) => ({
    subject: SUB_LABELS[key],
    ...Object.fromEntries(
      candidates.map((h, i) => [`site${i + 1}`, h.subscores[key] ?? 0])
    ),
  }));

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto p-1">
      {/* Radar chart */}
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 10 }} />
            {candidates.map((_, i) => (
              <Radar
                key={i}
                name={`Site ${i + 1}`}
                dataKey={`site${i + 1}`}
                stroke={COLORS[i]}
                fill={COLORS[i]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
            <Tooltip
              contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }}
              labelStyle={{ color: "#e2e8f0" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left text-slate-400 pb-1 font-normal">Factor</th>
              {candidates.map((_, i) => (
                <th key={i} className="pb-1 font-semibold text-right" style={{ color: COLORS[i] }}>
                  Site {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-700/30">
              <td className="py-1.5 text-white font-semibold">Total</td>
              {candidates.map((h, i) => (
                <td key={i} className="py-1.5 text-right font-bold" style={{ color: COLORS[i] }}>
                  {h.score.toFixed(0)}
                </td>
              ))}
            </tr>
            {Object.entries(SUB_LABELS).map(([key, label]) => (
              <tr key={key} className="border-t border-slate-700/20">
                <td className="py-1 text-slate-400">{label}</td>
                {candidates.map((h, i) => (
                  <td key={i} className="py-1 text-right text-slate-300">
                    {(h.subscores[key] ?? 0).toFixed(0)}
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
            className="flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs"
            style={{ borderColor: COLORS[i] + "60", color: COLORS[i] }}
          >
            <span>Site {i + 1}</span>
            <span className="text-[10px] text-slate-500 font-mono">{h.h3.slice(-6)}</span>
            <button onClick={() => onRemove(h.h3)} className="hover:opacity-70">
              <X size={10} />
            </button>
          </div>
        ))}
      </div>

      {/* AI recommendation */}
      {candidates.length >= 2 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Star size={12} className="text-amber-400" />
            <span className="text-xs font-semibold text-amber-300">AI Recommendation</span>
            {(aiRec as any)?.source === "template" && (
              <span className="text-[9px] text-slate-500 ml-auto">template</span>
            )}
          </div>
          {loading ? (
            <div className="h-3 w-48 bg-slate-700 rounded animate-pulse" />
          ) : aiRec ? (
            <p className="text-xs text-slate-300 leading-relaxed">{(aiRec as any).recommendation}</p>
          ) : (
            <p className="text-xs text-slate-500">Add at least 2 sites to compare.</p>
          )}
        </div>
      )}
    </div>
  );
}
