/**
 * Stock price polling cron (CareerOtter Phase 2, comp equity).
 *
 * Daily job: collect the distinct public tickers referenced by comp_entries,
 * fetch each one's current price from Finnhub, and cache it in stock_prices so
 * the equity scenario slider can anchor on the live market price.
 *
 * The feature is DARK until FINNHUB_API_KEY is set: with no key this route
 * no-ops cleanly (skipped response, no DB work, no external calls).
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/email/lifecycle-cron";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { fetchQuote, isPriceFeedConfigured } from "@/lib/careerotter/stock-price";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export const maxDuration = 300;

const ENDPOINT = "/api/cron/careerotter-stock-prices";
const MAX_TICKERS = 100; // Backstop for a runaway job; log if we hit it.
const CALL_DELAY_MS = 250; // Respect the Finnhub free-tier rate limit.

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

  let updated = 0;
  let missed = 0;
  for (let i = 0; i < toProcess.length; i++) {
    const ticker = toProcess[i];
    const price = await fetchQuote(ticker);
    if (price !== null) {
      const { error: upsertError } = await admin.from("stock_prices").upsert(
        { ticker, price, as_of: new Date().toISOString() },
        { onConflict: "ticker" }
      );
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
    metadata: { tickers: tickers.length, processed: toProcess.length, updated, missed },
  });

  return NextResponse.json({
    tickers: tickers.length,
    processed: toProcess.length,
    updated,
    missed,
  });
}
