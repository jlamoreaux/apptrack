/**
 * Market reference data (M5), v1. External and public sources only — BLS OES
 * plus public levels-style aggregates — crossed with the user's own entered
 * history at the API layer. Product copy says "market data" and claims nothing
 * proprietary (D4). Ranges are total-comp (USD) and deliberately coarse.
 *
 * The hard rule: if there's no credible range for a role/level, lookup returns
 * null and the UI shows the user's own history only, saying why. No fabricated
 * ranges — do not add a row without a real source.
 */

export const MARKET_DATA_SOURCE =
  "BLS OES (2024) + public levels-style aggregates";

export type CompLevel = "junior" | "mid" | "senior" | "staff";

export interface MarketRange {
  roleFamily: string;
  label: string;
  level: CompLevel;
  low: number;
  mid: number;
  high: number;
  currency: "USD";
  source: string;
}

export const COMP_ROLE_FAMILIES: { value: string; label: string }[] = [
  { value: "software_engineer", label: "Software Engineer" },
  { value: "product_manager", label: "Product Manager" },
  { value: "data", label: "Data / ML" },
  { value: "design", label: "Design" },
];

export const COMP_LEVELS: { value: CompLevel; label: string }[] = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "staff", label: "Staff / Lead" },
];

// Coarse public ranges. Total comp, USD. Sourced per MARKET_DATA_SOURCE.
const RANGES: Omit<MarketRange, "currency" | "source">[] = [
  { roleFamily: "software_engineer", label: "Software Engineer", level: "junior", low: 95_000, mid: 120_000, high: 150_000 },
  { roleFamily: "software_engineer", label: "Software Engineer", level: "mid", low: 130_000, mid: 165_000, high: 205_000 },
  { roleFamily: "software_engineer", label: "Software Engineer", level: "senior", low: 175_000, mid: 220_000, high: 280_000 },
  { roleFamily: "software_engineer", label: "Software Engineer", level: "staff", low: 240_000, mid: 300_000, high: 400_000 },
  { roleFamily: "product_manager", label: "Product Manager", level: "mid", low: 130_000, mid: 160_000, high: 195_000 },
  { roleFamily: "product_manager", label: "Product Manager", level: "senior", low: 170_000, mid: 210_000, high: 265_000 },
  { roleFamily: "data", label: "Data / ML", level: "mid", low: 135_000, mid: 170_000, high: 210_000 },
  { roleFamily: "data", label: "Data / ML", level: "senior", low: 180_000, mid: 225_000, high: 285_000 },
  { roleFamily: "design", label: "Design", level: "mid", low: 110_000, mid: 140_000, high: 175_000 },
  { roleFamily: "design", label: "Design", level: "senior", low: 150_000, mid: 185_000, high: 230_000 },
];

export function lookupMarketRange(
  roleFamily: string | null | undefined,
  level: string | null | undefined
): MarketRange | null {
  if (!roleFamily || !level) return null;
  const row = RANGES.find(
    (r) => r.roleFamily === roleFamily && r.level === level
  );
  if (!row) return null;
  return { ...row, currency: "USD", source: MARKET_DATA_SOURCE };
}

export interface CompDelta {
  /** Signed % vs the range midpoint (negative = under market). */
  pct: number;
  direction: "under" | "over" | "at";
}

export function compDelta(totalComp: number, range: MarketRange): CompDelta {
  if (range.mid <= 0) return { pct: 0, direction: "at" };
  const pct = Math.round(((totalComp - range.mid) / range.mid) * 100);
  const direction = pct < -1 ? "under" : pct > 1 ? "over" : "at";
  return { pct, direction };
}
