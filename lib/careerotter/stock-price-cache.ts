/**
 * Cached quotes for the comp page, refreshed on demand.
 *
 * stock_prices is filled by the daily cron, but a ticker a user has just added
 * would otherwise show nothing until the next 06:00 UTC run, and a day-old
 * price is not "live". So the comp API goes through this helper: it reads the
 * cache, fetches any ticker that is missing or older than QUOTE_TTL_MS straight
 * from Finnhub, writes the result back, and returns the merged set. The refresh
 * is bounded (MAX_REFRESH_PER_CALL) and best-effort: a failed fetch leaves the
 * cached row in place, and a failed write still returns the fresh quote.
 *
 * Dark without FINNHUB_API_KEY: only the cache is read.
 *
 * readCachedQuotes and loadCachedQuotes are the select-only variants for the
 * guest page's public endpoint, which must never let anonymous traffic drive
 * Finnhub usage. readValidCachedQuotes is the select-only variant for the MCP
 * tools, which must never spend the Finnhub budget or write the shared cache,
 * and which need a read failure reported rather than swallowed.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StockQuote } from "@/lib/careerotter/comp-projection";
import { fetchProfile, fetchQuote, isPriceFeedConfigured } from "@/lib/careerotter/stock-price";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { normalizeTicker, normalizeTickers } from "@/lib/careerotter/tickers";
import type { DomainResult } from "@/types";

/** How old a cached quote may be before a page view refreshes it. */
export const QUOTE_TTL_MS = 15 * 60 * 1000;
/** Most tickers one request will refresh live; the rest wait for the cron. */
export const MAX_REFRESH_PER_CALL = 5;

const STOCK_PRICES_TABLE = "stock_prices";
const SELECT_COLUMNS =
  "ticker, price, as_of, change, change_pct, previous_close, company_name, exchange, market_cap_musd, logo_url, profile_as_of";

interface StockPriceRow {
  ticker: string;
  price: unknown;
  as_of: string;
  change?: unknown;
  change_pct?: unknown;
  previous_close?: unknown;
  company_name?: string | null;
  exchange?: string | null;
  market_cap_musd?: unknown;
  logo_url?: string | null;
  profile_as_of?: string | null;
}

/** A numeric column that may be null on rows written before migration 043. */
const optional = (v: unknown): number | null =>
  v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);

/** The shape the comp page consumes, from a stock_prices row. */
export function rowToQuote(row: StockPriceRow): StockQuote {
  return {
    price: Number(row.price),
    as_of: row.as_of,
    change: optional(row.change),
    change_pct: optional(row.change_pct),
    previous_close: optional(row.previous_close),
    company_name: row.company_name ?? null,
    exchange: row.exchange ?? null,
    market_cap_musd: optional(row.market_cap_musd),
    logo_url: row.logo_url ?? null,
  };
}

/** True when the row is missing or its quote is older than the TTL. */
function isStale(row: StockPriceRow | undefined, now: number): boolean {
  if (!row) return true;
  const at = new Date(row.as_of).getTime();
  return !Number.isFinite(at) || now - at > QUOTE_TTL_MS;
}

interface CachedRowsRead {
  rows: unknown[];
  error: unknown;
}

async function selectCachedRows(
  admin: SupabaseClient,
  tickers: readonly string[]
): Promise<CachedRowsRead> {
  const { data, error } = await admin
    .from(STOCK_PRICES_TABLE)
    .select(SELECT_COLUMNS)
    .in("ticker", [...tickers]);
  return { rows: Array.isArray(data) ? data : [], error };
}

function logReadFailure(error: unknown): void {
  loggerService.error("Failed to read cached stock prices", error, {
    category: LogCategory.DATABASE,
    action: "stock_prices_read_failed",
  });
}

/**
 * The cached rows for the given tickers, keyed by ticker, without touching
 * the feed. The guest page's public endpoint uses this on its own so that
 * anonymous traffic can never drive Finnhub usage. A read failure is logged
 * and yields an empty map.
 */
export async function readCachedQuotes(
  admin: SupabaseClient,
  tickers: string[]
): Promise<Map<string, StockPriceRow>> {
  const cached = new Map<string, StockPriceRow>();
  if (tickers.length === 0) return cached;
  const { rows, error } = await selectCachedRows(admin, tickers);
  if (error) logReadFailure(error);
  for (const row of rows as StockPriceRow[]) cached.set(row.ticker, row);
  return cached;
}

/** Cached quotes only, in the shape the page consumes. */
export async function loadCachedQuotes(
  admin: SupabaseClient,
  tickers: string[]
): Promise<Record<string, StockQuote>> {
  const quotes: Record<string, StockQuote> = {};
  for (const [ticker, row] of await readCachedQuotes(admin, tickers)) {
    quotes[ticker] = rowToQuote(row);
  }
  return quotes;
}

/**
 * Quotes for the given tickers, keyed by ticker. Tickers with no quote at all
 * (unknown symbol, feed dark and nothing cached) are simply absent.
 */
export async function loadQuotes(
  admin: SupabaseClient,
  tickers: string[]
): Promise<Record<string, StockQuote>> {
  const quotes: Record<string, StockQuote> = {};
  if (tickers.length === 0) return quotes;

  const cached = await readCachedQuotes(admin, tickers);
  for (const [ticker, row] of cached) quotes[ticker] = rowToQuote(row);

  if (!isPriceFeedConfigured()) return quotes;

  const now = Date.now();
  const due = tickers.filter((t) => isStale(cached.get(t), now)).slice(0, MAX_REFRESH_PER_CALL);
  if (due.length === 0) return quotes;

  await Promise.all(
    due.map(async (ticker) => {
      const quote = await fetchQuote(ticker);
      if (quote === null) return;

      const existing = cached.get(ticker);
      const asOf = new Date().toISOString();
      const record: Record<string, unknown> = {
        ticker,
        price: quote.price,
        change: quote.change,
        change_pct: quote.changePct,
        previous_close: quote.previousClose,
        as_of: asOf,
      };
      // The profile changes rarely, so it is fetched only when the row has
      // none; the cron owns its monthly refresh.
      if (!existing?.profile_as_of) {
        const profile = await fetchProfile(ticker);
        if (profile) {
          record.company_name = profile.name;
          record.exchange = profile.exchange;
          record.market_cap_musd = profile.marketCapMusd;
          record.logo_url = profile.logoUrl;
          record.profile_as_of = asOf;
        }
      }

      const merged: StockPriceRow = { ...existing, ...record, ticker, price: quote.price, as_of: asOf };
      quotes[ticker] = rowToQuote(merged);

      const { error: upsertError } = await admin
        .from(STOCK_PRICES_TABLE)
        .upsert(record, { onConflict: "ticker" });
      if (upsertError) {
        loggerService.error("Failed to cache refreshed stock price", upsertError, {
          category: LogCategory.DATABASE,
          action: "stock_prices_upsert_failed",
          metadata: { ticker },
        });
      }
    })
  );

  return quotes;
}

function hasPositivePrice(price: unknown): boolean {
  if (typeof price === "number") return Number.isFinite(price) && price > 0;
  if (typeof price !== "string" || price.trim() === "") return false;
  const parsed = Number(price);
  return Number.isFinite(parsed) && parsed > 0;
}

function isoTimestamp(value: string): string | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

// rowToQuote reads price with Number(), so a row whose price is not numeric
// would otherwise surface as NaN; a zero or negative price is not a usable
// quote for any consumer.
function isStockPriceRow(value: unknown): value is StockPriceRow {
  if (typeof value !== "object" || value === null) return false;
  return "ticker" in value && typeof value.ticker === "string" &&
    "as_of" in value && typeof value.as_of === "string" &&
    "price" in value && hasPositivePrice(value.price);
}

// A quote no one can date cannot be judged fresh or stale, so it is dropped.
// as_of is returned in UTC ISO form (Postgres sends "+00:00" offsets), so
// consumers can compare and serialize it without re-parsing.
function toCachedQuote(row: unknown): { ticker: string; quote: StockQuote } | null {
  if (!isStockPriceRow(row)) return null;
  const asOf = isoTimestamp(row.as_of);
  if (asOf === null) return null;
  return { ticker: normalizeTicker(row.ticker), quote: { ...rowToQuote(row), as_of: asOf } };
}

function quotesFromRows(rows: readonly unknown[]): Record<string, StockQuote> {
  const quotes: Record<string, StockQuote> = {};
  let dropped = 0;
  for (const row of rows) {
    const cached = toCachedQuote(row);
    if (cached === null) dropped += 1;
    else quotes[cached.ticker] = cached.quote;
  }
  if (dropped > 0) {
    loggerService.warn("Dropped malformed cached stock price rows", {
      category: LogCategory.DATABASE,
      action: "stock_prices_row_malformed",
      metadata: { dropped },
    });
  }
  return quotes;
}

/**
 * Cached quotes for the given tickers, keyed by (normalized) ticker, straight
 * from stock_prices: no feed call and no write. Tickers are normalized with
 * normalizeTickers, so blanks and non-ticker strings are skipped. Tickers
 * with no cached row are absent; rows without a positive price or a parseable
 * as_of are dropped with a warning. as_of is returned as a UTC ISO timestamp.
 * Unlike readCachedQuotes, a read failure is a `db` result, not an empty set.
 */
export async function readValidCachedQuotes(
  admin: SupabaseClient,
  tickers: readonly string[]
): Promise<DomainResult<Record<string, StockQuote>>> {
  const unique = normalizeTickers(tickers);
  if (unique.length === 0) return { ok: true, value: {} };
  try {
    const { rows, error } = await selectCachedRows(admin, unique);
    if (error) return cachedQuotesFailure(error);
    return { ok: true, value: quotesFromRows(rows) };
  } catch (error) {
    return cachedQuotesFailure(error);
  }
}

function cachedQuotesFailure(error: unknown): DomainResult<Record<string, StockQuote>> {
  logReadFailure(error);
  return { ok: false, kind: "db", message: "Failed to load stock quotes" };
}
