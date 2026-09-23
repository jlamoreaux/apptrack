/**
 * Read-only MCP comp tools: entries, the current-package summary, multi-year
 * projections, cached equity quotes and the market benchmark.
 */

import { z } from "zod";
import {
  annualBreakdown,
  hasShares,
  projectComp,
  vestSummary,
  type StockQuote,
} from "@/lib/careerotter/comp-projection";
import { currentCompEntry, type StoredCompEntry } from "@/lib/careerotter/comp-service";
import { invalid, notFound, ok, overQuota } from "@/lib/careerotter/domain-result";
import {
  COMP_LEVELS,
  COMP_ROLE_FAMILIES,
  MARKET_DATA_SOURCE,
  compDelta,
  lookupMarketRange,
  type MarketRange,
} from "@/lib/careerotter/market-data";
import { isProUser } from "@/lib/careerotter/plan";
import {
  MCP_COMP_MESSAGES,
  MCP_MARKET_DELTA_DIRECTIONS,
  type McpPriceSource,
} from "@/lib/constants/mcp-comp";
import { defineTool, type DefinedTool } from "@/lib/mcp/define-tool";
import type { McpToolContext } from "@/lib/mcp/context";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type { DomainResult } from "@/types";
import {
  COMP_DESCRIPTION_NOTES as NOTES,
  COMP_READ_ANNOTATIONS,
  anchorFor,
  anchorPriceSourceOutput,
  annualBreakdownOutput,
  asOfInput,
  finiteNumber,
  loadCachedQuotes,
  loadEntries,
  priceSourceOutput,
  projectionRowOutput,
  projectionYears,
  projectionYearsInput,
  resolveAsOf,
  sharePriceInput,
  storedEntryOutput,
  sumTotals,
  toBreakdownOutput,
  toEntryOutput,
  toRowOutput,
  toVestOutput,
  vestSummaryOutput,
  type ResolvedAsOf,
} from "./comp-shared";

// ── list_comp_entries ──────────────────────────────────────────────────────

const listCompEntriesTool = defineTool({
  name: "list_comp_entries",
  title: "List comp entries",
  description: [
    "Lists every comp entry the user has, oldest effective_date first, including where each came from (source), its external_ref and timestamps.",
    NOTES.amounts,
    NOTES.equity,
  ].join(" "),
  scope: "comp:read",
  annotations: COMP_READ_ANNOTATIONS,
  inputSchema: {},
  outputSchema: z.object({ entries: z.array(storedEntryOutput) }),
  run: async (ctx) => {
    const entries = await loadEntries(ctx);
    if (!entries.ok) return entries;
    return ok({
      structured: { entries: entries.value.map(toEntryOutput) },
      summary: `${entries.value.length} comp entries.`,
    });
  },
});

// ── get_comp_summary ───────────────────────────────────────────────────────

const currentSummaryOutput = z.object({
  entry: storedEntryOutput,
  share_price: finiteNumber.nullable(),
  price_source: anchorPriceSourceOutput,
  annual: annualBreakdownOutput,
  vest: vestSummaryOutput.nullable(),
});
type CurrentSummary = z.infer<typeof currentSummaryOutput>;

async function summarizeCurrent(
  ctx: McpToolContext,
  entry: StoredCompEntry,
  asOf: ResolvedAsOf
): Promise<DomainResult<CurrentSummary>> {
  const quotes = await loadCachedQuotes(ctx, [entry.ticker]);
  if (!quotes.ok) return quotes;
  const anchor = anchorFor(entry, quotes.value);
  const vest = vestSummary(entry, anchor.price, asOf.instant);
  return ok({
    entry: toEntryOutput(entry),
    share_price: anchor.price,
    price_source: anchor.source,
    annual: toBreakdownOutput(annualBreakdown(entry, anchor.price)),
    vest: vest ? toVestOutput(vest) : null,
  });
}

const getCompSummaryTool = defineTool({
  name: "get_comp_summary",
  title: "Get comp summary",
  description: [
    "Summarizes the package in effect on as_of (the latest entry effective on or before it) and the next future-dated one (upcoming, e.g. an accepted offer not started yet).",
    "For the current package: the annual breakdown (vesting equity spread evenly over its vest length), where the grant stands on as_of, and the share price used with its source: quote (cached market price), implied (recorded equity divided by shares) or none.",
    "current is null when no entry is in effect yet.",
    NOTES.amounts,
    NOTES.equity,
    NOTES.utc,
  ].join(" "),
  scope: "comp:read",
  annotations: COMP_READ_ANNOTATIONS,
  inputSchema: { as_of: asOfInput },
  outputSchema: z.object({
    as_of: z.string(),
    current: currentSummaryOutput.nullable(),
    upcoming: storedEntryOutput.nullable(),
  }),
  run: async (ctx, input) => {
    const asOf = resolveAsOf(ctx, input.as_of);
    const entries = await loadEntries(ctx);
    if (!entries.ok) return entries;
    const picked = currentCompEntry(entries.value, asOf.date);
    const current = picked.current ? await summarizeCurrent(ctx, picked.current, asOf) : ok(null);
    if (!current.ok) return current;
    return ok({
      structured: {
        as_of: asOf.date,
        current: current.value,
        upcoming: picked.upcoming ? toEntryOutput(picked.upcoming) : null,
      },
    });
  },
});

// ── project_comp ───────────────────────────────────────────────────────────

interface PricedEntry {
  price: number | null;
  source: McpPriceSource;
}

function findTarget(
  entries: readonly StoredCompEntry[],
  entryId: string | undefined,
  asOf: ResolvedAsOf
): DomainResult<StoredCompEntry> {
  if (entryId === undefined) {
    const { current } = currentCompEntry(entries, asOf.date);
    return current ? ok(current) : notFound(MCP_COMP_MESSAGES.noCurrentEntry);
  }
  const entry = entries.find((candidate) => candidate.id === entryId);
  return entry ? ok(entry) : notFound(MCP_COMP_MESSAGES.entryNotFound);
}

async function priceFor(
  ctx: McpToolContext,
  entry: StoredCompEntry,
  sharePrice: number | undefined
): Promise<DomainResult<PricedEntry>> {
  if (sharePrice === undefined) {
    const quotes = await loadCachedQuotes(ctx, [entry.ticker]);
    return quotes.ok ? ok(anchorFor(entry, quotes.value)) : quotes;
  }
  if (!hasShares(entry)) return invalid(MCP_COMP_MESSAGES.sharePriceNeedsShares);
  return ok({ price: sharePrice, source: "given" });
}

const projectCompTool = defineTool({
  name: "project_comp",
  title: "Project comp",
  description: [
    "Projects one comp entry year by year with the comp page's vesting math: salary and bonus flat, stock as what vests in each calendar year, split into vested and still-unvested as of as_of.",
    "Defaults to the entry in effect on as_of. The years list starts with the as_of year.",
    "share_price overrides the price for share-based entries; without it the cached quote is used, else the price the recorded equity implies.",
    NOTES.amounts,
    NOTES.equity,
    NOTES.utc,
  ].join(" "),
  scope: "comp:read",
  annotations: COMP_READ_ANNOTATIONS,
  inputSchema: {
    entry_id: z.string().uuid().optional().describe("The entry to project. Defaults to the one in effect on as_of."),
    years: projectionYearsInput,
    share_price: sharePriceInput.optional(),
    as_of: asOfInput,
  },
  outputSchema: z.object({
    entry_id: z.string(),
    as_of: z.string(),
    share_price: finiteNumber.nullable(),
    price_source: priceSourceOutput,
    has_vest_schedule: z.boolean(),
    grant_value: finiteNumber,
    rows: z.array(projectionRowOutput),
    total: finiteNumber,
  }),
  run: async (ctx, input) => {
    const asOf = resolveAsOf(ctx, input.as_of);
    const entries = await loadEntries(ctx);
    if (!entries.ok) return entries;
    const target = findTarget(entries.value, input.entry_id, asOf);
    if (!target.ok) return target;
    const priced = await priceFor(ctx, target.value, input.share_price);
    if (!priced.ok) return priced;
    const projection = projectComp(target.value, {
      sharePrice: priced.value.price,
      years: projectionYears(asOf.year, input.years),
      asOf: asOf.instant,
    });
    return ok({
      structured: {
        entry_id: target.value.id,
        as_of: asOf.date,
        share_price: priced.value.price,
        price_source: priced.value.source,
        has_vest_schedule: projection.hasVestSchedule,
        grant_value: projection.grantValue,
        rows: projection.years.map(toRowOutput),
        total: sumTotals(projection.years),
      },
    });
  },
});

// ── get_equity_quotes ──────────────────────────────────────────────────────

const quoteOutput = z.object({
  ticker: z.string(),
  price: finiteNumber,
  as_of: z.string().datetime(),
  change: finiteNumber.nullable(),
  change_pct: finiteNumber.nullable(),
  previous_close: finiteNumber.nullable(),
  company_name: z.string().nullable(),
  exchange: z.string().nullable(),
  market_cap_musd: finiteNumber.nullable(),
});
type QuoteOutput = z.infer<typeof quoteOutput>;

function entryTickers(entries: readonly StoredCompEntry[]): string[] {
  const tickers = entries.flatMap((entry) => (entry.ticker ? [entry.ticker] : []));
  return [...new Set(tickers)].sort();
}

function toIsoTimestamp(value: string): string | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function toQuoteOutput(ticker: string, quote: StockQuote, asOf: string): QuoteOutput {
  return {
    ticker,
    price: quote.price,
    as_of: asOf,
    change: quote.change,
    change_pct: quote.change_pct,
    previous_close: quote.previous_close,
    company_name: quote.company_name,
    exchange: quote.exchange,
    market_cap_musd: quote.market_cap_musd,
  };
}

function splitQuotes(
  ctx: McpToolContext,
  tickers: readonly string[],
  quotes: Readonly<Record<string, StockQuote>>
): { quotes: QuoteOutput[]; missing: string[] } {
  const found: QuoteOutput[] = [];
  const missing: string[] = [];
  for (const ticker of tickers) {
    const quote = quotes[ticker];
    const asOf = quote ? toIsoTimestamp(quote.as_of) : null;
    if (quote && asOf !== null) found.push(toQuoteOutput(ticker, quote, asOf));
    else missing.push(ticker);
    if (quote && asOf === null) logUnreadableQuoteTime(ctx, ticker);
  }
  return { quotes: found, missing };
}

function logUnreadableQuoteTime(ctx: McpToolContext, ticker: string): void {
  loggerService.warn("Cached stock price has an unreadable as_of", {
    category: LogCategory.DATABASE,
    userId: ctx.userId,
    action: "stock_prices_row_malformed",
    metadata: { ticker },
  });
}

const getEquityQuotesTool = defineTool({
  name: "get_equity_quotes",
  title: "Get equity quotes",
  description: [
    "Returns the cached market quote for each ticker in the user's comp entries. Quotes are read from CareerOtter's daily cache only and are never fetched live, so as_of shows how old each one is.",
    "Tickers with no cached quote are listed in missing.",
  ].join(" "),
  scope: "comp:read",
  annotations: COMP_READ_ANNOTATIONS,
  inputSchema: {},
  outputSchema: z.object({
    quotes: z.array(quoteOutput),
    missing: z.array(z.string()),
  }),
  run: async (ctx) => {
    const entries = await loadEntries(ctx);
    if (!entries.ok) return entries;
    const tickers = entryTickers(entries.value);
    const quotes = await loadCachedQuotes(ctx, tickers);
    if (!quotes.ok) return quotes;
    return ok({ structured: splitQuotes(ctx, tickers, quotes.value) });
  },
});

// ── get_market_benchmark ───────────────────────────────────────────────────

// z.enum needs a non-empty tuple; the option lists are fixed, non-empty constants.
function optionValues(options: readonly { value: string }[]): [string, ...string[]] {
  const [first, ...rest] = options.map((option) => option.value);
  if (first === undefined) throw new Error("Benchmark option list is empty");
  return [first, ...rest];
}

const benchmarkOutput = z.object({
  role_family: z.string(),
  level: z.string(),
  as_of: z.string(),
  source: z.string(),
  range: z
    .object({
      label: z.string(),
      low: finiteNumber,
      mid: finiteNumber,
      high: finiteNumber,
      currency: z.literal("USD"),
    })
    .nullable(),
  reason: z.string().nullable(),
  current_total: finiteNumber.nullable(),
  delta: z
    .object({ pct: finiteNumber, direction: z.enum(MCP_MARKET_DELTA_DIRECTIONS) })
    .nullable(),
});
type BenchmarkOutput = z.infer<typeof benchmarkOutput>;
type BenchmarkComparison = Pick<BenchmarkOutput, "current_total" | "delta">;

// The comp page compares the annual total at the anchor price with the range.
async function compareCurrent(
  ctx: McpToolContext,
  range: MarketRange,
  asOf: ResolvedAsOf
): Promise<DomainResult<BenchmarkComparison>> {
  const entries = await loadEntries(ctx);
  if (!entries.ok) return entries;
  const { current } = currentCompEntry(entries.value, asOf.date);
  if (current === null) return ok({ current_total: null, delta: null });
  const quotes = await loadCachedQuotes(ctx, [current.ticker]);
  if (!quotes.ok) return quotes;
  const total = annualBreakdown(current, anchorFor(current, quotes.value).price).total;
  return ok({ current_total: total, delta: compDelta(total, range) });
}

// A plan entitlement is reported as `quota`: the arguments are valid, and the
// call succeeds only once the account's limits change, which is what quota
// failures already mean to clients.
async function requirePro(ctx: McpToolContext): Promise<DomainResult<null>> {
  const pro = await isProUser(ctx.admin, ctx.userId);
  if (!pro.ok) return pro;
  if (!pro.value) return overQuota(MCP_COMP_MESSAGES.benchmarkRequiresPro);
  return ok(null);
}

const getMarketBenchmarkTool = defineTool({
  name: "get_market_benchmark",
  title: "Get market benchmark",
  description: [
    "Compares the user's current annual total comp with a curated public market range (total comp, USD) for a role family and level. Requires CareerOtter Pro.",
    "range is null, with a reason, when there is no curated data for the pair; delta is null when no entry is in effect on as_of.",
    "delta.pct is the signed percent from the range midpoint.",
    NOTES.utc,
  ].join(" "),
  scope: "comp:read",
  annotations: COMP_READ_ANNOTATIONS,
  inputSchema: {
    role_family: z.enum(optionValues(COMP_ROLE_FAMILIES)),
    level: z.enum(optionValues(COMP_LEVELS)),
    as_of: asOfInput,
  },
  outputSchema: benchmarkOutput,
  run: async (ctx, input) => {
    const pro = await requirePro(ctx);
    if (!pro.ok) return pro;
    const asOf = resolveAsOf(ctx, input.as_of);
    const base = { role_family: input.role_family, level: input.level, as_of: asOf.date, source: MARKET_DATA_SOURCE };
    const range = lookupMarketRange(input.role_family, input.level);
    if (range === null) {
      return ok({
        structured: { ...base, range: null, reason: MCP_COMP_MESSAGES.noMarketData, current_total: null, delta: null },
      });
    }
    const comparison = await compareCurrent(ctx, range, asOf);
    if (!comparison.ok) return comparison;
    const { label, low, mid, high, currency } = range;
    return ok({
      structured: { ...base, range: { label, low, mid, high, currency }, reason: null, ...comparison.value },
    });
  },
});

export const COMP_READ_TOOLS: readonly DefinedTool[] = [
  listCompEntriesTool,
  getCompSummaryTool,
  projectCompTool,
  getEquityQuotesTool,
  getMarketBenchmarkTool,
];
