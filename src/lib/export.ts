/**
 * export.ts — CSV and PDF export utilities for SiteScope.
 */

import type { ScoredHex } from "@/lib/sitescope/scoring";

// ── CSV ───────────────────────────────────────────────────────────────────────

export function exportCSV(hexes: ScoredHex[], cityName: string): void {
  const headers = [
    "h3", "lat", "lng", "score", "eligible", "blocked_by",
    "sub_demand", "sub_accessibility", "sub_complementary",
    "sub_competition", "sub_landuse", "sub_risk",
  ];

  const rows = hexes
    .sort((a, b) => b.score - a.score)
    .map((h) => [
      h.h3,
      h.center[1].toFixed(6),
      h.center[0].toFixed(6),
      h.score.toFixed(1),
      h.eligible ? "yes" : "no",
      "", // blocked_by — placeholder
      ...Object.values(h.subscores || {}).map((v) => Number(v).toFixed(1)),
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

  const top3Rows = top3
    .map(
      (h, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${h.h3}</td>
        <td>${h.score.toFixed(1)}</td>
        <td>${Object.entries(h.subscores || {})
          .map(([k, v]) => `${k}: ${Number(v).toFixed(0)}`)
          .join(", ")}</td>
      </tr>`,
    )
    .join("");

  const weightsRows = Object.entries(weights)
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join("");

  w.document.write(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SiteScope Report — ${cityName}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 2rem; color: #111; max-width: 800px; margin: auto; }
  h1 { color: #1e3a5f; border-bottom: 2px solid #d97706; padding-bottom: .5rem; }
  h2 { color: #374151; margin-top: 2rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { border: 1px solid #d1d5db; padding: .5rem .75rem; text-align: left; }
  th { background: #f3f4f6; }
  .badge { background: #fef3c7; color: #92400e; padding: .2rem .6rem; border-radius: 9999px; font-size: .8rem; }
  .meta { color: #6b7280; font-size: .9rem; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>🏙️ SiteScope Report</h1>
<p class="meta">City: <strong>${cityName}</strong> &nbsp;|&nbsp; Business: <strong>${businessSummary}</strong> &nbsp;|&nbsp; Average score: <strong>${avgScore.toFixed(1)}/100</strong></p>
<p class="meta">Generated: ${new Date().toLocaleString()}</p>
<span class="badge">⚠️ Synthetic data — for demonstration only</span>

<h2>Top 3 Recommended Sites</h2>
<table>
  <thead><tr><th>Rank</th><th>Hex ID</th><th>Score</th><th>Sub-scores</th></tr></thead>
  <tbody>${top3Rows}</tbody>
</table>

<h2>Scoring Weights</h2>
<table>
  <thead><tr><th>Factor</th><th>Weight</th></tr></thead>
  <tbody>${weightsRows}</tbody>
</table>

<h2>Data Sources</h2>
<p>All spatial data is synthetic and generated for demonstration purposes. In production, replace with WorldPop rasters, OSM Overpass extracts, and real land-use zoning data.</p>

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
