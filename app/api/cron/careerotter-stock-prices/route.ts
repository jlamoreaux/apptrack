/**
 * Stock price polling cron (CareerOtter Phase 2, comp equity).
 *
 * Daily job: collect the distinct public tickers referenced by comp_entries,
 * fetch each one's current quote from Finnhub, and cache it in stock_prices so
 * the comp page can anchor its equity numbers on the live market price and
 * show the day's move. The company profile (name, exchange, market cap, logo)
 * is fetched once per ticker and refreshed monthly. The comp API also refreshes
 * a missing or stale quote on demand (lib/careerotter/stock-price-cache.ts);
 * this job keeps the cache warm so most page views never wait on Finnhub.
 *
 * The feature is DARK until FINNHUB_API_KEY is set: with no key this route
 * no-ops cleanly (skipped response, no DB work, no external calls).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/email/lifecycle-cron";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { fetchProfile, fetchQuote, isPriceFeedConfigured } from "@/lib/careerotter/stock-price";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export const maxDuration = 300;

const ENDPOINT = "/api/cron/careerotter-stock-prices";
const MAX_TICKERS = 100; // Backstop for a runaway job; log if we hit it.
const CALL_DELAY_MS = 250; // Respect the Finnhub free-tier rate limit.
const PROFILE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // Profiles change rarely; refresh monthly.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyCronAuth(request, ENDPOINT)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPriceFeedConfigured()) {
    return NextResponse.json({ skipped: "no FINNHUB_API_KEY" });
  }

  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("comp_entries")
    .select("ticker")
    .not("ticker", "is", null);

  if (error) {
    loggerService.error("Stock price cron: failed to load tickers", error, {
      category: LogCategory.BUSINESS,
      action: "careerotter_stock_prices_query_failed",
    });
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }

  // Dedupe non-empty tickers in code (the table stores per-entry rows).
  const tickers = [
    ...new Set(
      (rows ?? [])
        .map((r) => (typeof r.ticker === "string" ? r.ticker.trim() : ""))
        .filter((t) => t.length > 0)
    ),
  ];

  const capped = tickers.length > MAX_TICKERS;
  const toProcess = tickers.slice(0, MAX_TICKERS);
  if (capped) {
    loggerService.warn("Stock price cron: ticker count exceeded cap; some skipped", {
      category: LogCategory.BUSINESS,
      action: "careerotter_stock_prices_capped",
      metadata: { total: tickers.length, cap: MAX_TICKERS },
    });
  }

  // Which tickers still need a profile (never fetched, or older than the TTL).
  const profileDue = new Set<string>(toProcess);
  if (toProcess.length > 0) {
    const { data: existing } = await admin
      .from("stock_prices")
      .select("ticker, profile_as_of")
      .in("ticker", toProcess);
    const cutoff = Date.now() - PROFILE_TTL_MS;
    for (const row of existing ?? []) {
      const at = row.profile_as_of ? new Date(row.profile_as_of).getTime() : 0;
      if (at > cutoff) profileDue.delete(row.ticker);
    }
  }

  let updated = 0;
  let missed = 0;
  let profiles = 0;
  for (let i = 0; i < toProcess.length; i++) {
    const ticker = toProcess[i];
    const quote = await fetchQuote(ticker);
    if (quote !== null) {
      const now = new Date().toISOString();
      const record: Record<string, unknown> = {
        ticker,
        price: quote.price,
        change: quote.change,
        change_pct: quote.changePct,
        previous_close: quote.previousClose,
        as_of: now,
      };
      if (profileDue.has(ticker)) {
        await sleep(CALL_DELAY_MS);
        const profile = await fetchProfile(ticker);
        if (profile) {
          record.company_name = profile.name;
          record.exchange = profile.exchange;
          record.market_cap_musd = profile.marketCapMusd;
          record.logo_url = profile.logoUrl;
          record.profile_as_of = now;
          profiles += 1;
        }
      }
      const { error: upsertError } = await admin
        .from("stock_prices")
        .upsert(record, { onConflict: "ticker" });
      if (upsertError) {
        missed += 1;
        loggerService.error("Stock price cron: upsert failed", upsertError, {
          category: LogCategory.DATABASE,
          action: "careerotter_stock_prices_upsert_failed",
          metadata: { ticker },
        });
      } else {
        updated += 1;
      }
    } else {
      missed += 1;
    }

    // Throttle between calls (skip after the last one).
    if (i < toProcess.length - 1) await sleep(CALL_DELAY_MS);
  }

  loggerService.info("Stock price cron complete", {
    category: LogCategory.BUSINESS,
    action: "careerotter_stock_prices_complete",
    metadata: {
      tickers: tickers.length,
      processed: toProcess.length,
      updated,
      missed,
      profiles,
    },
  });

  return NextResponse.json({
    tickers: tickers.length,
    processed: toProcess.length,
    updated,
    missed,
    profiles,
  });
}
