/**
 * Schemas, serializers and loaders shared by the MCP comp tools. Projection
 * math always comes from lib/careerotter/comp-projection so agents get the
 * same numbers as the comp page.
 */

import { z } from "zod";
import {
  anchorSharePrice,
  type AnnualBreakdown,
  type CompEntry,
  type ProjectionYear,
  type StockQuote,
  type VestSummary,
} from "@/lib/careerotter/comp-projection";
import { listCompEntries, type StoredCompEntry } from "@/lib/careerotter/comp-service";
import { readValidCachedQuotes } from "@/lib/careerotter/stock-price-cache";
import { normalizeTicker } from "@/lib/careerotter/tickers";
import { COMP_SOURCES } from "@/lib/constants/careerotter";
import {
  MCP_ANCHOR_PRICE_SOURCES,
  MCP_COMP_PROJECTION_YEARS,
  MCP_PRICE_SOURCES,
  MCP_QUOTE_STALE_AFTER_MS,
  MCP_SHARE_PRICE_MAX,
  type McpAnchorPriceSource,
  type McpPriceSource,
} from "@/lib/constants/mcp-comp";
import { formatDateAsLocal } from "@/lib/utils/date";
import type { McpToolContext } from "@/lib/mcp/context";
import type { DomainResult } from "@/types";

// ── input schemas ──────────────────────────────────────────────────────────

// Loose type-level bounds only: the comp service owns every business rule, so
// REST and MCP validate identically.
export const amountInput = z.number().finite().nonnegative();

export const sharePriceInput = z
  .number()
  .finite()
  .positive()
  .max(MCP_SHARE_PRICE_MAX)
  .describe(`Share price in USD, greater than 0 and at most ${MCP_SHARE_PRICE_MAX}.`);

export const projectionYearsInput = z
  .number()
  .int()
  .min(MCP_COMP_PROJECTION_YEARS.min)
  .max(MCP_COMP_PROJECTION_YEARS.max)
  .default(MCP_COMP_PROJECTION_YEARS.default)
  .describe(
    `How many calendar years to project, starting with the as_of year (${MCP_COMP_PROJECTION_YEARS.min}-${MCP_COMP_PROJECTION_YEARS.max}, default ${MCP_COMP_PROJECTION_YEARS.default}).`
  );

// ── output schemas ─────────────────────────────────────────────────────────

export const finiteNumber = z.number().finite();

export const storedEntryOutput = z.object({
  id: z.string(),
  effective_date: z.string(),
  base: finiteNumber,
  bonus: finiteNumber,
  equity: finiteNumber,
  currency: z.string(),
  note: z.string().nullable(),
  ticker: z.string().nullable(),
  shares: finiteNumber.nullable(),
  vest_start: z.string().nullable(),
  vest_years: finiteNumber.nullable(),
  vest_cliff_months: finiteNumber.nullable(),
  source: z.enum(COMP_SOURCES),
  external_ref: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string().nullable(),
});
export type StoredEntryOutput = z.infer<typeof storedEntryOutput>;

export const projectionRowOutput = z.object({
  year: z.number().int(),
  salary: finiteNumber,
  incentives: finiteNumber,
  stock_vested: finiteNumber,
  stock_unvested: finiteNumber,
  stock: finiteNumber,
  total: finiteNumber,
});
export type ProjectionRowOutput = z.infer<typeof projectionRowOutput>;

export const annualBreakdownOutput = z.object({
  salary: finiteNumber,
  incentives: finiteNumber,
  equity_per_year: finiteNumber,
  total: finiteNumber,
});
export type AnnualBreakdownOutput = z.infer<typeof annualBreakdownOutput>;

export const vestSummaryOutput = z.object({
  grant_value: finiteNumber,
  vested_fraction: finiteNumber,
  vested_value: finiteNumber,
  unvested_value: finiteNumber,
  cliff_date: z.string().nullable(),
  cliff_passed: z.boolean(),
  cliff_value: finiteNumber,
  fully_vested_date: z.string(),
  fully_vested: z.boolean(),
});
export type VestSummaryOutput = z.infer<typeof vestSummaryOutput>;

export const priceSourceOutput = z.enum(MCP_PRICE_SOURCES);
export const anchorPriceSourceOutput = z.enum(MCP_ANCHOR_PRICE_SOURCES);

/** Spread into any output that reports a price_source. */
export const priceFreshnessOutput = {
  price_as_of: z.string().datetime().nullable(),
  price_is_stale: z.boolean(),
};
export interface PriceFreshnessOutput {
  price_as_of: string | null;
  price_is_stale: boolean;
}

// ── serializers ────────────────────────────────────────────────────────────

export function toEntryOutput(entry: StoredCompEntry): StoredEntryOutput {
  return {
    id: entry.id,
    effective_date: entry.effective_date,
    base: entry.base,
    bonus: entry.bonus,
    equity: entry.equity,
    currency: entry.currency,
    note: entry.note,
    ticker: entry.ticker,
    shares: entry.shares,
    vest_start: entry.vest_start,
    vest_years: entry.vest_years,
    vest_cliff_months: entry.vest_cliff_months,
    source: entry.source,
    external_ref: entry.external_ref,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}

export function toRowOutput(row: ProjectionYear): ProjectionRowOutput {
  return {
    year: row.year,
    salary: row.salary,
    incentives: row.incentives,
    stock_vested: row.stockVested,
    stock_unvested: row.stockUnvested,
    stock: row.stock,
    total: row.total,
  };
}

export function toBreakdownOutput(breakdown: AnnualBreakdown): AnnualBreakdownOutput {
  return {
    salary: breakdown.salary,
    incentives: breakdown.incentives,
    equity_per_year: breakdown.equityPerYear,
    total: breakdown.total,
  };
}

// Vest dates are built with local-time constructors, so they are formatted
// with local getters to name the same calendar day.
export function toVestOutput(vest: VestSummary): VestSummaryOutput {
  return {
    grant_value: vest.grantValue,
    vested_fraction: vest.vestedFraction,
    vested_value: vest.vestedValue,
    unvested_value: vest.unvestedValue,
    cliff_date: vest.cliffDate ? formatDateAsLocal(vest.cliffDate) : null,
    cliff_passed: vest.cliffPassed,
    cliff_value: vest.cliffValue,
    fully_vested_date: formatDateAsLocal(vest.fullyVestedDate),
    fully_vested: vest.fullyVested,
  };
}

export function sumTotals(rows: readonly ProjectionYear[]): number {
  return rows.reduce((sum, row) => sum + row.total, 0);
}

// ── projection years ───────────────────────────────────────────────────────

export function consecutiveYears(firstYear: number, count: number): number[] {
  return Array.from({ length: count }, (_, offset) => firstYear + offset);
}

// ── loaders ────────────────────────────────────────────────────────────────

export function loadEntries(ctx: McpToolContext): Promise<DomainResult<StoredCompEntry[]>> {
  return listCompEntries(ctx.admin, ctx.userId);
}

/** Cached quotes only: MCP tools never call the price feed or write the cache. */
export function loadCachedQuotes(
  ctx: McpToolContext,
  tickers: readonly (string | null)[]
): Promise<DomainResult<Record<string, StockQuote>>> {
  const present = tickers.filter((ticker): ticker is string => ticker !== null);
  return readValidCachedQuotes(ctx.admin, present);
}

function quoteFor(
  entry: CompEntry,
  quotes: Readonly<Record<string, StockQuote>>
): StockQuote | null {
  return entry.ticker ? quotes[normalizeTicker(entry.ticker)] ?? null : null;
}

/** A share price, where it came from, and when its quote was taken (quotes only). */
export interface PricePoint<S extends McpPriceSource = McpPriceSource> {
  price: number | null;
  source: S;
  quoteAsOf: string | null;
}

/** The price the comp page would anchor on, and where it came from. */
export function anchorFor(
  entry: CompEntry,
  quotes: Readonly<Record<string, StockQuote>>
): PricePoint<McpAnchorPriceSource> {
  const quote = quoteFor(entry, quotes);
  const price = anchorSharePrice(entry, quote);
  if (price === null) return { price, source: "none", quoteAsOf: null };
  if (quote !== null && price === quote.price) {
    return { price, source: "quote", quoteAsOf: quote.as_of };
  }
  return { price, source: "implied", quoteAsOf: null };
}

export function givenPrice(price: number): PricePoint {
  return { price, source: "given", quoteAsOf: null };
}

/**
 * price_as_of and price_is_stale for a price point. Staleness is judged at the
 * request time, not as_of: it says whether the market price is current.
 */
export function priceFreshness(now: Date, point: PricePoint): PriceFreshnessOutput {
  if (point.quoteAsOf === null) return { price_as_of: null, price_is_stale: false };
  const age = now.getTime() - Date.parse(point.quoteAsOf);
  return { price_as_of: point.quoteAsOf, price_is_stale: age > MCP_QUOTE_STALE_AFTER_MS };
}
