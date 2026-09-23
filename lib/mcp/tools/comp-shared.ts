/**
 * Schemas, serializers and loaders shared by the MCP comp tools. Projection
 * math always comes from lib/careerotter/comp-projection so agents get the
 * same numbers as the comp page.
 */

import { z } from "zod";
import {
  anchorSharePrice,
  parseLocalDate,
  type AnnualBreakdown,
  type CompEntry,
  type ProjectionYear,
  type StockQuote,
  type VestSummary,
} from "@/lib/careerotter/comp-projection";
import { listCompEntries, type StoredCompEntry } from "@/lib/careerotter/comp-service";
import { isCalendarDate, toIsoDate } from "@/lib/careerotter/domain-result";
import { readCachedQuotes } from "@/lib/careerotter/stock-price-cache";
import { COMP_SOURCES } from "@/lib/constants/careerotter";
import { ISO_DATE_PATTERN } from "@/lib/constants/dates";
import {
  MCP_ANCHOR_PRICE_SOURCES,
  MCP_COMP_PROJECTION_YEARS,
  MCP_PRICE_SOURCES,
  MCP_SHARE_PRICE_MAX,
  type McpAnchorPriceSource,
} from "@/lib/constants/mcp-comp";
import { formatDateAsLocal } from "@/lib/utils/date";
import type { McpToolAnnotations } from "@/lib/mcp/define-tool";
import type { McpToolContext } from "@/lib/mcp/context";
import type { DomainResult } from "@/types";

// ── description fragments ──────────────────────────────────────────────────

export const COMP_DESCRIPTION_NOTES = {
  amounts: "All amounts are annual USD.",
  equity:
    "Equity: when vest_years is set, equity is the total grant value vesting over those years; when vest_years is empty, equity is the annual equity amount.",
  utc: "Dates are evaluated in UTC (the comp page uses the browser's timezone, so results can differ by a day at date boundaries); pass as_of (YYYY-MM-DD) to pin the date.",
  writeCurrency:
    "Amounts must be annual USD: convert, or ask the user, before writing an amount given in another currency.",
  agentRowsOnly:
    'Only entries an agent created (source "agent") can be updated or deleted; entries the user typed in report not found.',
} as const;

// ── annotations ────────────────────────────────────────────────────────────

export const COMP_READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const satisfies McpToolAnnotations;

// ── input schemas ──────────────────────────────────────────────────────────

export const asOfInput = z
  .string()
  .regex(ISO_DATE_PATTERN)
  .refine(isCalendarDate, { message: "as_of must be a real YYYY-MM-DD date" })
  .optional()
  .describe("Evaluate as of this date (YYYY-MM-DD). Defaults to today in UTC.");

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

// Vest dates are built with local-time constructors (UTC on the server), so
// they are formatted with local getters to name the same calendar day.
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

// ── as_of ──────────────────────────────────────────────────────────────────

export interface ResolvedAsOf {
  /** The YYYY-MM-DD date entries are picked by. */
  date: string;
  /** The instant vesting is measured at. */
  instant: Date;
  /** The first projected calendar year. */
  year: number;
}

/**
 * A pinned as_of is measured from the start of that day; without one, "now"
 * is the request time, as on the comp page.
 */
export function resolveAsOf(ctx: McpToolContext, asOf: string | undefined): ResolvedAsOf {
  const date = asOf ?? toIsoDate(ctx.now);
  const dayStart = parseLocalDate(date);
  return {
    date,
    instant: asOf === undefined ? ctx.now : dayStart,
    year: dayStart.getFullYear(),
  };
}

export function projectionYears(firstYear: number, count: number): number[] {
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
  return readCachedQuotes(ctx.admin, present);
}

export function quoteFor(
  entry: CompEntry,
  quotes: Readonly<Record<string, StockQuote>>
): StockQuote | null {
  return entry.ticker ? quotes[entry.ticker] ?? null : null;
}

export interface AnchorPrice {
  price: number | null;
  source: McpAnchorPriceSource;
}

/** The price the comp page would anchor on, and where it came from. */
export function anchorFor(
  entry: CompEntry,
  quotes: Readonly<Record<string, StockQuote>>
): AnchorPrice {
  const quote = quoteFor(entry, quotes);
  const price = anchorSharePrice(entry, quote);
  if (price === null) return { price, source: "none" };
  return { price, source: quote !== null && price === quote.price ? "quote" : "implied" };
}
