import { useState, useEffect } from "react";
import { Bot, Sparkles, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { explainSite, type AiExplanation } from "@/lib/api";
import type { ScoredHex } from "@/lib/sitescope/scoring";

interface AiExplanationProps {
  hex: ScoredHex | null;
  business: string;
}

export function AiExplanationPanel({ hex, business }: AiExplanationProps) {
  const [data, setData] = useState<AiExplanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!hex || !open) return;
    setLoading(true);
    setData(null);
    const site = {
      h3: hex.h3,
      score: hex.score,
      eligible: hex.eligible,
      ...Object.fromEntries(Object.entries(hex.subscores).map(([k, v]) => [`sub_${k}`, v])),
    };
    explainSite(site, business).then((res) => {
      setData(res);
      setLoading(false);
    });
  }, [hex?.h3, open, business]);

  if (!hex) return null;

  return (
    <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-indigo-500/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bot size={14} className="text-indigo-400" />
          <span className="text-xs font-semibold text-indigo-300">AI Analysis</span>
          {data?.source === "gemini" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Live
            </span>
          )}
          {data?.source === "template" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/30">
              Template
            </span>
          )}
        </div>
        {open ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 flex flex-col gap-3">
          {loading ? (
            <div className="flex flex-col gap-2 pt-1">
              {[100, 80, 60].map((w, i) => (
                <div key={i} className={`h-2.5 rounded bg-slate-700 animate-pulse`} style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : data ? (
            <>
              {/* Summary */}
              <p className="text-xs text-slate-300 leading-relaxed">{data.summary}</p>

              {/* Strengths */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles size={10} className="text-emerald-400" />
                  <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">Strengths</span>
                </div>
                <ul className="flex flex-col gap-1">
                  {data.strengths?.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                      <span className="text-emerald-400 mt-0.5">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Risks */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertCircle size={10} className="text-amber-400" />
                  <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">Risks</span>
                </div>
                <ul className="flex flex-col gap-1">
                  {data.risks?.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-300">
                      <span className="text-amber-400 mt-0.5">!</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Suggestion */}
              {data.suggestion && (
                <div className="rounded-md bg-slate-700/40 px-3 py-2 text-xs text-slate-200 italic">
                  💡 {data.suggestion}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-slate-500">No explanation available.</p>
          )}
        </div>
      )}
    </div>
  );
}
