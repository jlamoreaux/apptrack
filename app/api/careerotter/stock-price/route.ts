/**
 * Cached stock quotes for the guest comp page.
 *
 * GET /api/careerotter/stock-price?tickers=NET,AAPL -> { prices, priceFeedEnabled }
 *
 * Public and read-only: it returns only what the daily cron has already cached
 * in stock_prices, never calling the price feed itself, so an anonymous visitor
 * cannot drive external API usage. A ticker nobody tracks yet is simply absent
 * and the page falls back to the price the visitor types.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { isPriceFeedConfigured } from "@/lib/careerotter/stock-price";
import { loadCachedQuotes } from "@/lib/careerotter/stock-price-cache";
import { normalizeTickers } from "@/lib/careerotter/tickers";

const MAX_TICKERS = 5;

export async function GET(request: NextRequest) {
  const raw = new URL(request.url).searchParams.get("tickers") ?? "";
  const tickers = normalizeTickers(raw.split(",")).slice(0, MAX_TICKERS);
  const prices = tickers.length > 0 ? await loadCachedQuotes(createAdminClient(), tickers) : {};
  return NextResponse.json(
    { prices, priceFeedEnabled: isPriceFeedConfigured() },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
