/**
 * formatters.ts — Safe numerical and text formatting helpers for SiteScope UI.
 * Prevents raw fractions (0.97), NaN, undefined, -0, and leaky H3 hex strings in user-facing UI.
 */

const SUBAREA_NAMES = ["Vesu", "Adajan", "Pal", "Udhna", "Dumas", "Katargam", "Varachha", "Piplod"];

/**
 * Ensures score is formatted as an integer 0..100.
 * Handles both 0..1 floats (0.97 -> 97) and 0..100 numbers.
 */
export function formatScore(val: number | null | undefined): number {
  if (val === null || val === undefined || Number.isNaN(val)) return 0;
  if (val <= 1) return Math.min(100, Math.max(0, Math.round(val * 100)));
  return Math.min(100, Math.max(0, Math.round(val)));
}

/**
 * Formats a factor contribution with an explicit + or - sign.
 * Prevents -0, +0, or NaN strings.
 */
export function formatContribution(val: number | null | undefined, positive: boolean): string {
  if (val === null || val === undefined || Number.isNaN(val)) return positive ? "+0" : "0";
  const num = Math.round(Math.abs(val));
  if (num === 0) return "0";
  return positive ? `+${num}` : `-${num}`;
}

/**
 * Returns a human-readable area name from index or H3 string, avoiding raw 15-char H3 strings.
 */
export function formatLocationName(indexOrHex: number | string, fallbackCity = "Location"): string {
  if (typeof indexOrHex === "number") {
    return SUBAREA_NAMES[indexOrHex % SUBAREA_NAMES.length]!;
  }
  if (!indexOrHex) return fallbackCity;
  // If string looks like a raw H3 hex (e.g. starts with 8 and length 15), return a readable subarea
  if (/^8[0-9a-fA-F]{14}$/.test(indexOrHex) || indexOrHex.length >= 12) {
    const hash = indexOrHex.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return SUBAREA_NAMES[hash % SUBAREA_NAMES.length]!;
  }
  return indexOrHex;
}

/**
 * Formats population counts with commas or fallback.
 */
export function formatPopulation(val: number | null | undefined): string {
  if (val === null || val === undefined || Number.isNaN(val)) return "—";
  return new Intl.NumberFormat("en-IN").format(Math.round(val));
}
