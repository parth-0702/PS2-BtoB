/**
 * export.ts — CSV and PDF export utilities for SiteScope.
 */

import type { ScoredHex } from "@/lib/sitescope/scoring";
import { formatScore, formatLocationName } from "@/lib/formatters";

// ── CSV ───────────────────────────────────────────────────────────────────────

export function exportCSV(hexes: ScoredHex[], cityName: string): void {
  const headers = [
    "h3", "location_name", "lat", "lng", "score", "eligible", "blocked_by",
    "sub_demand", "sub_accessibility", "sub_complementary",
    "sub_competition", "sub_landuse", "sub_risk",
  ];

  const rows = hexes
    .sort((a, b) => b.score - a.score)
    .map((h, i) => [
      h.h3,
      formatLocationName(i),
      h.center[1].toFixed(6),
      h.center[0].toFixed(6),
      (h.score100 || formatScore(h.score)).toString(),
      h.eligible ? "yes" : "no",
      "", // blocked_by — placeholder
      ...Object.values(h.subscores || {}).map((v) => Number(v).toFixed(0)),
    ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  _download(csv, `sitescope_${cityName.toLowerCase()}_${Date.now()}.csv`, "text/csv");
}

// ── PDF (print) ───────────────────────────────────────────────────────────────

export function exportPDF(
  cityName: string,
  businessSummary: string,
  top3: ScoredHex[],
  weights: Record<string, number>,
  avgScore: number,
): void {
  const w = window.open("", "_blank");
  if (!w) return;

  const formattedAvgScore = formatScore(avgScore);

  const top3Rows = top3
    .map(
      (h, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${formatLocationName(i)}</strong> <span style="color:#64748b; font-size: 0.85em;">(${h.h3.slice(-6)})</span></td>
        <td><strong>${h.score100 || formatScore(h.score)} / 100</strong></td>
        <td>${Object.entries(h.subscores || {})
          .map(([k, v]) => `${k}: ${Number(v).toFixed(0)}`)
          .join(", ")}</td>
      </tr>`,
    )
    .join("");

  const weightsRows = Object.entries(weights)
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}%</td></tr>`)
    .join("");

  w.document.write(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SiteScope Report — ${cityName}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 2.5rem; color: #0f172a; max-width: 850px; margin: auto; }
  h1 { color: #0f172a; border-bottom: 2px solid #0d9488; padding-bottom: .5rem; font-size: 1.75rem; }
  h2 { color: #334155; margin-top: 2rem; font-size: 1.25rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem; }
  th, td { border: 1px solid #e2e8f0; padding: .65rem .85rem; text-align: left; }
  th { background: #f8fafc; color: #475569; font-weight: 600; }
  .badge { background: #f0fdf4; color: #166534; padding: .3rem .75rem; border-radius: 9999px; font-size: .8rem; border: 1px solid #bbf7d0; display: inline-block; margin-top: 0.5rem; }
  .meta { color: #64748b; font-size: .95rem; margin-bottom: 0.5rem; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>🏙️ SiteScope Location Intelligence Report</h1>
<p class="meta">Target City: <strong>${cityName}</strong> &nbsp;|&nbsp; Business Format: <strong>${businessSummary}</strong> &nbsp;|&nbsp; Top Site Score: <strong>${formattedAvgScore}/100</strong></p>
<p class="meta">Generated: ${new Date().toLocaleString()}</p>
<span class="badge">✓ Production Location Analysis</span>

<h2>Top Recommended Locations</h2>
<table>
  <thead><tr><th>Rank</th><th>Location / Area</th><th>Readiness Score</th><th>Factor Breakdown</th></tr></thead>
  <tbody>${top3Rows}</tbody>
</table>

<h2>Scoring Weight Configuration</h2>
<table>
  <thead><tr><th>Factor</th><th>Weight Percentage</th></tr></thead>
  <tbody>${weightsRows}</tbody>
</table>

<h2>Data Methodology</h2>
<p style="font-size: 0.85rem; color: #64748b;">Spatial scoring combines demographic density, road accessibility, competitor proximity, land-use zoning, and environmental risk layers.</p>

<script>window.onload = () => { window.print(); }</script>
</body>
</html>`);
  w.document.close();
}

// ── Helper ────────────────────────────────────────────────────────────────────

function _download(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
