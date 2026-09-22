/**
 * Cached stock quotes, as the comp page consumes them. One place turns
 * stock_prices rows into StockQuote objects so the account and guest
 * endpoints cannot drift.
 */

import type { createAdminClient } from "@/lib/supabase/admin-client";
import type { StockQuote } from "./comp-projection";

const TICKER = /^[A-Z0-9.-]{1,10}$/;

/** Uppercase, trimmed, deduplicated tickers that look like tickers. */
export function normalizeTickers(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const ticker = typeof value === "string" ? value.trim().toUpperCase() : "";
    if (ticker && TICKER.test(ticker)) seen.add(ticker);
  }
  return [...seen];
}

/** A numeric column that may be null on rows written before migration 043. */
const optional = (v: unknown): number | null =>
  v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v);

/** Cached quotes for the given tickers; tickers with no row are simply absent. */
export async function loadQuotes(
  admin: ReturnType<typeof createAdminClient>,
  tickers: string[]
): Promise<Record<string, StockQuote>> {
  const prices: Record<string, StockQuote> = {};
  if (tickers.length === 0) return prices;
  const { data: rows } = await admin
    .from("stock_prices")
    .select(
      "ticker, price, as_of, change, change_pct, previous_close, company_name, exchange, market_cap_musd, logo_url"
    )
    .in("ticker", tickers);
  for (const row of rows ?? []) {
    prices[row.ticker] = {
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
  return prices;
}
