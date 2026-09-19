import { useMemo } from "react";
import {
  Trophy,
  TrendingUp,
  Users,
  DollarSign,
  Zap,
  MapPin,
  Shield,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import type { ScoredHex } from "@/lib/sitescope/scoring";
import type { City, ScoringConfig } from "@/lib/sitescope/types";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";

interface ResultsSidebarProps {
  top3: ScoredHex[];
  scored: ScoredHex[];
  city: City;
  config: ScoringConfig;
  onSelectHex: (h3: string) => void;
  selectedH3: string | null;
}

const MEDALS = ["🥇", "🥈", "🥉"];

const LAYER_ICONS: Record<string, React.ReactNode> = {
  population: <Users className="w-3 h-3" />,
  footfall: <TrendingUp className="w-3 h-3" />,
  accessibility: <Zap className="w-3 h-3" />,
  complementary: <MapPin className="w-3 h-3" />,
  competition: <Shield className="w-3 h-3" />,
  rent: <DollarSign className="w-3 h-3" />,
};

function ScoreBar({ score, color = "oklch(0.5 0.105 214)" }: { score: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${score * 100}%`, background: color }}
      />
    </div>
  );
}

function getScoreColor(score: number) {
  if (score >= 0.65) return "oklch(0.68 0.13 168)";
  if (score >= 0.4) return "oklch(0.72 0.16 68)";
  return "oklch(0.62 0.2 32)";
}

export function ResultsSidebar({ top3, scored, city, config, onSelectHex, selectedH3 }: ResultsSidebarProps) {
  const eligible = scored.filter((h) => h.eligible).length;
  const avgScore = scored.reduce((s, h) => s + h.score, 0) / scored.length;

  // Score distribution buckets
  const distribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    for (const h of scored) {
      const idx = Math.min(4, Math.floor((h.score ?? 0) * 5));
      if (buckets[idx] !== undefined) {
        buckets[idx]++;
      }
    }
    return ["0–20", "20–40", "40–60", "60–80", "80–100"].map((range, i) => ({
      range,
      count: buckets[i] ?? 0,
    }));
  }, [scored]);

  // Weights bar chart
  const weightsData = useMemo(() => {
    return Object.entries(config.weights).map(([layer, w]) => ({
      name: layer.slice(0, 4),
      fullName: layer,
      value: Math.round(w * 100),
    }));
  }, [config]);

  return (
    <div
      className="w-full h-full flex flex-col overflow-y-auto border-l border-border bg-card/95"
      style={{ width: 340 }}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-foreground text-sm">Results — {city.name}</h2>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-foreground">{eligible}</span> eligible
          </span>
          <span>
            <span className="font-semibold text-foreground">{scored.length}</span> total hexes
          </span>
          <span>
            avg <span className="font-semibold text-foreground">{Math.round(avgScore * 100)}</span>
          </span>
        </div>
      </div>

      {/* Top 3 sites */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-border">
        <div className="flex items-center gap-1.5 mb-3">
          <Trophy className="w-3.5 h-3.5 text-signal" />
          <h3 className="font-display font-semibold text-foreground text-xs uppercase tracking-wide">
            Top 3 Sites
          </h3>
        </div>
        <div className="space-y-2">
          {top3.map((h, i) => {
            const isSelected = h.h3 === selectedH3;
            const scoreColor = getScoreColor(h.score);
            return (
              <button
                key={h.h3}
                id={`top-site-${i + 1}`}
                onClick={() => onSelectHex(h.h3)}
                className="w-full text-left p-3 rounded-xl border transition-all duration-150 hover:shadow-sm group"
                style={{
                  borderColor: isSelected ? "oklch(0.5 0.105 214)" : "var(--color-border)",
                  background: isSelected ? "oklch(0.5 0.105 214 / 0.06)" : "var(--color-background)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{MEDALS[i]}</span>
                    <div>
                      <div className="text-xs font-semibold text-foreground">Site {i + 1}</div>
                      <div className="text-xs text-muted-foreground font-mono">{h.h3.slice(0, 10)}…</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="text-sm font-display font-bold"
                      style={{ color: scoreColor }}
                    >
                      {Math.round(h.score * 100)}
                    </div>
                    <ChevronRight
                      className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors"
                    />
                  </div>
                </div>
                <ScoreBar score={h.score} color={scoreColor} />
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="capitalize">{h.raw.landuse}</span>
                  <span style={{ color: { high: "oklch(0.68 0.13 168)", medium: "oklch(0.72 0.16 68)", low: "oklch(0.62 0.2 32)" }[h.robustness] }}>
                    {h.robustness} robustness
                  </span>
                  {(h.underservedScore > 0.25 || h.underserved) && (
                    <span style={{ color: "oklch(0.68 0.13 168)" }}>underserved</span>
                  )}
                </div>

                {/* mini breakdown */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {h.parts
                    .filter((p) => p.contribution > 0.04)
                    .sort((a, b) => b.contribution - a.contribution)
                    .slice(0, 4)
                    .map((p) => (
                      <div
                        key={p.layer}
                        className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md"
                        style={{
                          background: "var(--color-muted)",
                          color: "var(--color-muted-foreground)",
                        }}
                      >
                        {LAYER_ICONS[p.layer]}
                        {Math.round(p.value * 100)}
                      </div>
                    ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Score distribution */}
      <div className="flex-shrink-0 px-4 py-4 border-b border-border">
        <h3 className="font-display font-semibold text-foreground text-xs uppercase tracking-wide mb-3">
          Score Distribution
        </h3>
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={distribution} margin={{ top: 0, right: 0, bottom: 0, left: -16 }}>
            <XAxis dataKey="range" tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} />
            <YAxis tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }} />
            <Tooltip
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 11,
              }}
              formatter={(v) => [v, "hexes"]}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {distribution.map((_, i) => (
                <Cell
                  key={i}
                  fill={
                    i >= 3
                      ? "oklch(0.68 0.13 168)"
                      : i === 2
                        ? "oklch(0.72 0.16 68)"
                        : "oklch(0.5 0.105 214 / 0.5)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weights */}
      <div className="px-4 py-4">
        <h3 className="font-display font-semibold text-foreground text-xs uppercase tracking-wide mb-3">
          Scoring Weights
        </h3>
        <div className="space-y-2">
          {weightsData
            .slice()
            .sort((a, b) => b.value - a.value)
            .map((w) => (
              <div key={w.fullName}>
                <div className="flex justify-between items-center mb-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-foreground">
                    <span className="text-muted-foreground">{LAYER_ICONS[w.fullName]}</span>
                    <span className="capitalize">{w.fullName}</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{w.value}%</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(w.value / 50) * 100}%`,
                      background: "oklch(0.5 0.105 214)",
                      maxWidth: "100%",
                    }}
                  />
                </div>
              </div>
            ))}
        </div>

        {/* City blurb */}
        <div
          className="mt-4 p-3 rounded-xl text-xs text-muted-foreground leading-relaxed"
          style={{ background: "var(--color-surface)" }}
        >
          <div className="font-semibold text-foreground mb-1 text-xs">{city.name} overview</div>
          {city.blurb}
        </div>
      </div>
    </div>
  );
}
