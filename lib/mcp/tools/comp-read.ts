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
import { normalizeTicker } from "@/lib/careerotter/tickers";
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
  MCP_COMP_CURRENCY,
  MCP_COMP_DESCRIPTION_NOTES as NOTES,
  MCP_COMP_MESSAGES,
  MCP_MARKET_DELTA_DIRECTIONS,
} from "@/lib/constants/mcp-comp";
import { MCP_RECORD_NOUNS, countNoun } from "@/lib/constants/mcp-tools";
import { READ_ANNOTATIONS } from "@/lib/mcp/annotations";
import {
  defineTool,
  type DefinedTool,
  type ToolInput,
  type ToolSuccess,
} from "@/lib/mcp/define-tool";
import type { McpToolContext } from "@/lib/mcp/context";
import { asOfInput, resolveAsOf, type ResolvedAsOf } from "@/lib/mcp/tool-inputs";
import type { DomainResult } from "@/types";
import {
  anchorFor,
  anchorPriceSourceOutput,
  annualBreakdownOutput,
  finiteNumber,
  givenPrice,
  loadCachedQuotes,
  loadEntries,
  priceFreshness,
  priceFreshnessOutput,
  priceSourceOutput,
  projectionRowOutput,
  consecutiveYears,
  projectionYearsInput,
  sharePriceInput,
  storedEntryOutput,
  sumTotals,
  toBreakdownOutput,
  toEntryOutput,
  toRowOutput,
  toVestOutput,
  vestSummaryOutput,
  type PriceFreshnessOutput,
  type PricePoint,
} from "./comp-shared";

const { singular: ENTRY, plural: ENTRIES } = MCP_RECORD_NOUNS.compEntry;

type ToolRun<O> = Promise<DomainResult<ToolSuccess<O>>>;

// ── list_comp_entries ──────────────────────────────────────────────────────

const listOutput = z.object({ entries: z.array(storedEntryOutput) });

async function runListCompEntries(ctx: McpToolContext): ToolRun<z.infer<typeof listOutput>> {
  const entries = await loadEntries(ctx);
  if (!entries.ok) return entries;
  return ok({
    structured: { entries: entries.value.map(toEntryOutput) },
    summary: `Returned ${countNoun(entries.value.length, ENTRY, ENTRIES)}.`,
  });
}

const listCompEntriesTool = defineTool({
  name: "list_comp_entries",
  title: "List comp entries",
  description: [
    "List every comp entry the user has, oldest effective_date first, including where each came from (source), its external_ref and timestamps.",
    NOTES.amounts,
    NOTES.equity,
  ].join(" "),
  scope: "comp:read",
  annotations: READ_ANNOTATIONS,
  inputSchema: {},
  outputSchema: listOutput,
  run: runListCompEntries,
});

// ── get_comp_summary ───────────────────────────────────────────────────────

const currentSummaryOutput = z.object({
  entry: storedEntryOutput,
  share_price: finiteNumber.nullable(),
  price_source: anchorPriceSourceOutput,
  ...priceFreshnessOutput,
  annual: annualBreakdownOutput,
  vest: vestSummaryOutput.nullable(),
});
type CurrentSummary = z.infer<typeof currentSummaryOutput>;

const summaryInput = { as_of: asOfInput };
const summaryOutput = z.object({
  as_of: z.string(),
  current: currentSummaryOutput.nullable(),
  upcoming: storedEntryOutput.nullable(),
});

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
    ...priceFreshness(ctx.now, anchor),
    annual: toBreakdownOutput(annualBreakdown(entry, anchor.price)),
    vest: vest ? toVestOutput(vest) : null,
  });
}

async function runGetCompSummary(
  ctx: McpToolContext,
  input: ToolInput<typeof summaryInput>
): ToolRun<z.infer<typeof summaryOutput>> {
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
}

const getCompSummaryTool = defineTool({
  name: "get_comp_summary",
  title: "Get comp summary",
  description: [
    "Summarize the package in effect on as_of (the latest entry effective on or before it) and the next future-dated one (upcoming, e.g. an accepted offer not started yet).",
    "For the current package: the annual breakdown (vesting equity spread evenly over its vest length), where the grant stands on as_of, and the share price used with its source: quote (cached market price), implied (recorded equity divided by shares) or none.",
    "current is null when no entry is in effect yet.",
    NOTES.priceFreshness,
    NOTES.amounts,
    NOTES.equity,
    NOTES.utc,
  ].join(" "),
  scope: "comp:read",
  annotations: READ_ANNOTATIONS,
  inputSchema: summaryInput,
  outputSchema: summaryOutput,
  run: runGetCompSummary,
});

// ── project_comp ───────────────────────────────────────────────────────────

const projectInput = {
  entry_id: z
    .string()
    .uuid()
    .optional()
    .describe("The comp entry's id. Defaults to the one in effect on as_of."),
  years: projectionYearsInput,
  share_price: sharePriceInput.optional(),
  as_of: asOfInput,
};
const projectOutput = z.object({
  entry_id: z.string(),
  as_of: z.string(),
  share_price: finiteNumber.nullable(),
  price_source: priceSourceOutput,
  ...priceFreshnessOutput,
  has_vest_schedule: z.boolean(),
  grant_value: finiteNumber,
  rows: z.array(projectionRowOutput),
  total: finiteNumber,
});
type ProjectOutput = z.infer<typeof projectOutput>;

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
): Promise<DomainResult<PricePoint>> {
  if (sharePrice === undefined) {
    const quotes = await loadCachedQuotes(ctx, [entry.ticker]);
    return quotes.ok ? ok(anchorFor(entry, quotes.value)) : quotes;
  }
  if (!hasShares(entry)) return invalid(MCP_COMP_MESSAGES.sharePriceNeedsShares);
  return ok(givenPrice(sharePrice));
}

function projectEntry(
  ctx: McpToolContext,
  entry: StoredCompEntry,
  point: PricePoint,
  window: { asOf: ResolvedAsOf; years: number }
): ProjectOutput {
  const projection = projectComp(entry, {
    sharePrice: point.price,
    years: consecutiveYears(window.asOf.year, window.years),
    asOf: window.asOf.instant,
  });
  return {
    entry_id: entry.id,
    as_of: window.asOf.date,
    share_price: point.price,
    price_source: point.source,
    ...priceFreshness(ctx.now, point),
    has_vest_schedule: projection.hasVestSchedule,
    grant_value: projection.grantValue,
    rows: projection.years.map(toRowOutput),
    total: sumTotals(projection.years),
  };
}

async function runProjectComp(
  ctx: McpToolContext,
  input: ToolInput<typeof projectInput>
): ToolRun<ProjectOutput> {
  const asOf = resolveAsOf(ctx, input.as_of);
  const entries = await loadEntries(ctx);
  if (!entries.ok) return entries;
  const target = findTarget(entries.value, input.entry_id, asOf);
  if (!target.ok) return target;
  const priced = await priceFor(ctx, target.value, input.share_price);
  if (!priced.ok) return priced;
  const window = { asOf, years: input.years };
  return ok({ structured: projectEntry(ctx, target.value, priced.value, window) });
}

const projectCompTool = defineTool({
  name: "project_comp",
  title: "Project comp",
  description: [
    "Project one comp entry year by year with the comp page's vesting math: salary and bonus flat, stock as what vests in each calendar year, split into vested and still-unvested as of as_of.",
    "Defaults to the entry in effect on as_of. The years list starts with the as_of year.",
    "share_price overrides the price for share-based entries; without it the cached quote is used, else the price the recorded equity implies.",
    NOTES.priceFreshness,
    NOTES.amounts,
    NOTES.equity,
    NOTES.utc,
  ].join(" "),
  scope: "comp:read",
  annotations: READ_ANNOTATIONS,
  inputSchema: projectInput,
  outputSchema: projectOutput,
  run: runProjectComp,
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

const quotesOutput = z.object({
  quotes: z.array(quoteOutput),
  missing: z.array(z.string()),
});
type QuotesOutput = z.infer<typeof quotesOutput>;

function entryTickers(entries: readonly StoredCompEntry[]): string[] {
  const tickers = entries.flatMap((entry) => (entry.ticker ? [entry.ticker] : []));
  return [...new Set(tickers)].sort();
}

function toQuoteOutput(ticker: string, quote: StockQuote): QuoteOutput {
  return {
    ticker,
    price: quote.price,
    as_of: quote.as_of,
    change: quote.change,
    change_pct: quote.change_pct,
    previous_close: quote.previous_close,
    company_name: quote.company_name,
    exchange: quote.exchange,
    market_cap_musd: quote.market_cap_musd,
  };
}

// readValidCachedQuotes keys quotes by normalized ticker and drops rows without a
// positive price or a readable as_of, so anything it did not return is missing.
function splitQuotes(
  tickers: readonly string[],
  quotes: Readonly<Record<string, StockQuote>>
): QuotesOutput {
  const found: QuoteOutput[] = [];
  const missing: string[] = [];
  for (const ticker of tickers) {
    const quote = quotes[normalizeTicker(ticker)];
    if (quote) found.push(toQuoteOutput(ticker, quote));
    else missing.push(ticker);
  }
  return { quotes: found, missing };
}

async function runGetEquityQuotes(ctx: McpToolContext): ToolRun<QuotesOutput> {
  const entries = await loadEntries(ctx);
  if (!entries.ok) return entries;
  const tickers = entryTickers(entries.value);
  const quotes = await loadCachedQuotes(ctx, tickers);
  if (!quotes.ok) return quotes;
  return ok({ structured: splitQuotes(tickers, quotes.value) });
}

const getEquityQuotesTool = defineTool({
  name: "get_equity_quotes",
  title: "Get equity quotes",
  description: [
    "Get the cached market quote for each ticker in the user's comp entries. Quotes are read from CareerOtter's daily cache only and are never fetched live, so as_of shows how old each one is.",
    "Tickers with no usable cached quote are listed in missing.",
  ].join(" "),
  scope: "comp:read",
  annotations: READ_ANNOTATIONS,
  inputSchema: {},
  outputSchema: quotesOutput,
  run: runGetEquityQuotes,
});

// ── get_market_benchmark ───────────────────────────────────────────────────

// z.enum needs a non-empty tuple; the option lists are fixed, non-empty constants.
function optionValues(options: readonly { value: string }[]): [string, ...string[]] {
  const [first, ...rest] = options.map((option) => option.value);
  if (first === undefined) throw new Error("Benchmark option list is empty");
  return [first, ...rest];
}

const benchmarkInput = {
  role_family: z.enum(optionValues(COMP_ROLE_FAMILIES)),
  level: z.enum(optionValues(COMP_LEVELS)),
  as_of: asOfInput,
};

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
      currency: z.literal(MCP_COMP_CURRENCY),
    })
    .nullable(),
  reason: z.string().nullable(),
  current_total: finiteNumber.nullable(),
  ...priceFreshnessOutput,
  delta: z
    .object({ pct: finiteNumber, direction: z.enum(MCP_MARKET_DELTA_DIRECTIONS) })
    .nullable(),
});
type BenchmarkOutput = z.infer<typeof benchmarkOutput>;
type BenchmarkComparison = Pick<BenchmarkOutput, "current_total" | "delta"> &
  PriceFreshnessOutput;

const NO_COMPARISON: BenchmarkComparison = {
  current_total: null,
  delta: null,
  price_as_of: null,
  price_is_stale: false,
};

// The comp page compares the annual total at the anchor price with the range.
async function compareCurrent(
  ctx: McpToolContext,
  range: MarketRange,
  asOf: ResolvedAsOf
): Promise<DomainResult<BenchmarkComparison>> {
  const entries = await loadEntries(ctx);
  if (!entries.ok) return entries;
  const { current } = currentCompEntry(entries.value, asOf.date);
  if (current === null) return ok(NO_COMPARISON);
  const quotes = await loadCachedQuotes(ctx, [current.ticker]);
  if (!quotes.ok) return quotes;
  const anchor = anchorFor(current, quotes.value);
  const total = annualBreakdown(current, anchor.price).total;
  return ok({
    current_total: total,
    delta: compDelta(total, range),
    ...priceFreshness(ctx.now, anchor),
  });
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

async function runGetMarketBenchmark(
  ctx: McpToolContext,
  input: ToolInput<typeof benchmarkInput>
): ToolRun<BenchmarkOutput> {
  const pro = await requirePro(ctx);
  if (!pro.ok) return pro;
  const asOf = resolveAsOf(ctx, input.as_of);
  const { role_family, level } = input;
  const base = { role_family, level, as_of: asOf.date, source: MARKET_DATA_SOURCE };
  const range = lookupMarketRange(role_family, level);
  if (range === null) {
    const reason = MCP_COMP_MESSAGES.noMarketData;
    return ok({ structured: { ...base, range: null, reason, ...NO_COMPARISON } });
  }
  const comparison = await compareCurrent(ctx, range, asOf);
  if (!comparison.ok) return comparison;
  const { label, low, mid, high, currency } = range;
  const rangeOutput = { label, low, mid, high, currency };
  return ok({ structured: { ...base, range: rangeOutput, reason: null, ...comparison.value } });
}

const getMarketBenchmarkTool = defineTool({
  name: "get_market_benchmark",
  title: "Get market benchmark",
  description: [
    `Compare the user's current annual total comp with a curated public market range (total comp, ${MCP_COMP_CURRENCY}) for a role family and level. Requires CareerOtter Pro.`,
    "range is null, with a reason, when there is no curated data for the pair; delta is null when no entry is in effect on as_of.",
    "delta.pct is the signed percent from the range midpoint.",
    "price_as_of and price_is_stale describe the cached quote behind current_total when one was used.",
    NOTES.utc,
  ].join(" "),
  scope: "comp:read",
  annotations: READ_ANNOTATIONS,
  inputSchema: benchmarkInput,
  outputSchema: benchmarkOutput,
  run: runGetMarketBenchmark,
});

export const COMP_READ_TOOLS: readonly DefinedTool[] = [
  listCompEntriesTool,
  getCompSummaryTool,
  projectCompTool,
  getEquityQuotesTool,
  getMarketBenchmarkTool,
];
