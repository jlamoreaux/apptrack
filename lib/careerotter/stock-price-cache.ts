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
 * readCachedQuotes is the select-only variant for the MCP tools, which must
 * never spend the Finnhub budget or write the shared cache.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StockQuote } from "@/lib/careerotter/comp-projection";
import { fetchProfile, fetchQuote, isPriceFeedConfigured } from "@/lib/careerotter/stock-price";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import type { DomainResult } from "@/types";

/** How old a cached quote may be before a page view refreshes it. */
export const QUOTE_TTL_MS = 15 * 60 * 1000;
/** Most tickers one request will refresh live; the rest wait for the cron. */
export const MAX_REFRESH_PER_CALL = 5;

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

  const { data: rows, error } = await admin
    .from("stock_prices")
    .select(SELECT_COLUMNS)
    .in("ticker", tickers);
  if (error) {
    loggerService.error("Failed to read cached stock prices", error, {
      category: LogCategory.DATABASE,
      action: "stock_prices_read_failed",
    });
  }

  const cached = new Map<string, StockPriceRow>();
  for (const row of (rows ?? []) as StockPriceRow[]) {
    cached.set(row.ticker, row);
    quotes[row.ticker] = rowToQuote(row);
  }

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
        .from("stock_prices")
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

function isStockPriceRow(value: unknown): value is StockPriceRow {
  if (typeof value !== "object" || value === null) return false;
  return "ticker" in value && typeof value.ticker === "string" &&
    "as_of" in value && typeof value.as_of === "string";
}

/**
 * Cached quotes for the given tickers, keyed by ticker, straight from
 * stock_prices: no feed call and no write. Tickers with no cached row are
 * absent.
 */
export async function readCachedQuotes(
  admin: SupabaseClient,
  tickers: readonly string[]
): Promise<DomainResult<Record<string, StockQuote>>> {
  const quotes: Record<string, StockQuote> = {};
  const unique = [...new Set(tickers)];
  if (unique.length === 0) return { ok: true, value: quotes };
  try {
    const { data: rows, error } = await admin
      .from("stock_prices")
      .select(SELECT_COLUMNS)
      .in("ticker", unique);
    if (error) return cachedQuotesFailure(error);
    for (const row of Array.isArray(rows) ? rows : []) {
      if (isStockPriceRow(row)) quotes[row.ticker] = rowToQuote(row);
    }
    return { ok: true, value: quotes };
  } catch (error) {
    return cachedQuotesFailure(error);
  }
}

function cachedQuotesFailure(error: unknown): DomainResult<Record<string, StockQuote>> {
  loggerService.error("Failed to read cached stock prices", error, {
    category: LogCategory.DATABASE,
    action: "stock_prices_read_failed",
  });
  return { ok: false, kind: "db", message: "Failed to load stock quotes" };
}
