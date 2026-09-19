import { X, AlertTriangle, TrendingUp, Users, Zap, DollarSign, MapPin, Shield, BarChart3, GitCompare, Check } from "lucide-react";
import type { ScoredHex } from "@/lib/sitescope/scoring";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { AiExplanationPanel } from "./AiExplanation";

interface HexDetailPanelProps {
  hex: ScoredHex;
  onClose: () => void;
  onAddToCompare?: () => void;
  inCompare?: boolean;
  business?: string;
}

const LAYER_ICONS: Record<string, React.ReactNode> = {
  population: <Users className="w-3.5 h-3.5" />,
  footfall: <TrendingUp className="w-3.5 h-3.5" />,
  accessibility: <Zap className="w-3.5 h-3.5" />,
  complementary: <MapPin className="w-3.5 h-3.5" />,
  competition: <Shield className="w-3.5 h-3.5" />,
  rent: <DollarSign className="w-3.5 h-3.5" />,
};

const LAYER_COLORS: Record<string, string> = {
  population: "#3b82f6",
  footfall: "#10b981",
  accessibility: "#f59e0b",
  complementary: "#8b5cf6",
  competition: "#ef4444",
  rent: "#6366f1",
};

// Build a subscores-like map from parts[] for compatibility
function getSubscores(hex: ScoredHex): Record<string, number> {
  return Object.fromEntries(hex.parts.map((p) => [p.layer, Math.round(p.value * 100)]));
}

export function HexDetailPanel({ hex, onClose, onAddToCompare, inCompare, business = "retail store" }: HexDetailPanelProps) {
  const scorePercent = Math.round(hex.score * 100);
  const subscores = getSubscores(hex);

  const radarData = hex.parts.map((p) => ({
    subject: p.label.split(" ")[0],
    value: Math.round(p.value * 100),
    fullMark: 100,
  }));

  const robustnessColor = {
    high: "#10b981",
    medium: "#f59e0b",
    low: "#ef4444",
  }[hex.robustness];

  // Hotspot label from gi score
  const hotspotLabel =
    hex.gi > 2.58 ? "🔴 Hot spot 99%"
    : hex.gi > 1.96 ? "🟠 Hot spot 95%"
    : hex.gi > 1.65 ? "🟡 Hot spot 90%"
    : hex.gi < -1.65 ? "🔵 Cold spot"
    : null;

  return (
    <div
      className="flex-shrink-0 border-t border-slate-700/50 bg-[#141720]/98 backdrop-blur-sm"
      style={{ maxHeight: 300 }}
    >
      <div className="flex h-full">
        {/* ── Score ring + radar ── */}
        <div className="flex-shrink-0 w-52 border-r border-slate-700/40 p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-slate-500 truncate max-w-[110px]">{hex.h3.slice(0, 12)}…</span>
            <div className="flex items-center gap-1.5">
              {onAddToCompare && (
                <button
                  onClick={onAddToCompare}
                  title={inCompare ? "In compare list" : "Add to compare"}
                  className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-all border ${
                    inCompare
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                      : "bg-slate-700/40 border-slate-600/30 text-slate-400 hover:text-white"
                  }`}
                >
                  {inCompare ? <Check size={9} /> : <GitCompare size={9} />}
                  {inCompare ? "Added" : "Compare"}
                </button>
              )}
              <button
                id="hex-detail-close"
                onClick={onClose}
                className="p-1 rounded hover:bg-slate-700/50 transition-colors"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Score ring */}
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="22" fill="none" stroke="#1e293b" strokeWidth="5" />
                <circle
                  cx="28" cy="28" r="22"
                  fill="none"
                  stroke={scorePercent >= 65 ? "#10b981" : scorePercent >= 40 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${(scorePercent / 100) * 138.2} 138.2`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-bold text-base text-white">{scorePercent}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-xs font-semibold text-white">Score / 100</div>
              <div className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${robustnessColor}20`, color: robustnessColor }}>
                {hex.robustness} robustness
              </div>
              <div className="text-[10px] text-slate-400 capitalize">{hex.raw.landuse}</div>
              {hotspotLabel && <div className="text-[10px]">{hotspotLabel}</div>}
            </div>
          </div>

          {/* Radar */}
          <div className="flex-1" style={{ minHeight: 90 }}>
            <ResponsiveContainer width="100%" height={90}>
              <RadarChart data={radarData} margin={{ top: 2, right: 8, bottom: 2, left: 8 }}>
                <PolarGrid stroke="rgba(255,255,255,0.06)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fill: "#64748b" }} />
                <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={1.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Score breakdown bars ── */}
        <div className="flex-1 p-3 overflow-y-auto">
          <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Score breakdown
          </h4>
          <div className="space-y-1.5">
            {hex.parts
              .slice()
              .sort((a, b) => b.contribution - a.contribution)
              .map((part) => {
                const pct = Math.round(part.value * 100);
                const color = LAYER_COLORS[part.layer] ?? "#3b82f6";
                return (
                  <div key={part.layer}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-300">
                        <span style={{ color }}>{LAYER_ICONS[part.layer]}</span>
                        {part.label}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500">wt {Math.round(part.weight * 100)}%</span>
                        <span className="font-mono font-semibold text-white">{pct}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>

          {/* AI explanation panel */}
          <div className="mt-3">
            <AiExplanationPanel
              hex={{ ...hex, subscores } as any}
              business={business}
            />
          </div>
        </div>

        {/* ── Raw stats ── */}
        <div className="flex-shrink-0 w-44 border-l border-slate-700/40 p-3 space-y-3">
          <div>
            <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Raw data</h4>
            <div className="space-y-1">
              {[
                { label: "Population", val: hex.raw.population },
                { label: "Footfall", val: hex.raw.footfall },
                { label: "Accessibility", val: hex.raw.accessibility },
                { label: "Rent pressure", val: hex.raw.rent },
                { label: "Flood risk", val: hex.raw.floodRisk },
                { label: "Parking", val: hex.raw.parking },
              ].map(({ label, val }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-mono font-medium text-slate-200">{Math.round(val * 100)}</span>
                </div>
              ))}
            </div>
          </div>

          {hex.blockedBy.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-red-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />Blocked by
              </h4>
              <ul className="space-y-0.5">
                {hex.blockedBy.map((b, i) => (
                  <li key={i} className="text-[10px] text-slate-400 flex items-start gap-1">
                    <span className="mt-0.5 w-1 h-1 rounded-full bg-red-500 flex-shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(hex.underservedScore > 0.25 || hex.underserved) && (
            <div className="rounded-lg p-2 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <div className="font-semibold mb-0.5">Underserved area</div>
              <div className="opacity-80">High demand, low competition</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
