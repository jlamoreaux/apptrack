/**
 * Comp tracker (CareerOtter Phase 2, M5).
 *
 * GET  /api/careerotter/comp?roleFamily=&level=  -> { entries, marketRange, isPro, prices, priceFeedEnabled }
 * POST /api/careerotter/comp                      -> add a comp entry
 *
 * Validation, storage and analytics live in lib/careerotter/comp-service.ts,
 * shared with the MCP tools; this route maps service results onto HTTP.
 *
 * Tracking your own numbers is free. The market benchmark (the "market-vs-you"
 * intelligence, D2) is the Pro value-add, so marketRange is only returned for
 * Pro. No fabricated ranges: if there's no curated data for the role/level,
 * marketRange is null and the UI shows own-history only.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { lookupMarketRange, type MarketRange } from "@/lib/careerotter/market-data";
import { isPriceFeedConfigured } from "@/lib/careerotter/stock-price";
import { loadQuotes } from "@/lib/careerotter/stock-price-cache";
import {
  createCompEntry,
  listCompEntries,
  toCompEntry,
  type StoredCompEntry,
} from "@/lib/careerotter/comp-service";
import { isPlainObject } from "@/lib/careerotter/domain-result";
import { domainErrorResponse } from "@/lib/careerotter/domain-response";
import { MANUAL_SOURCE } from "@/lib/constants/careerotter";

const MESSAGES = {
  unauthorized: "Unauthorized",
  invalidJson: "Invalid JSON body",
  bodyNotObject: "Request body must be a JSON object",
} as const;

function trackedTickers(entries: StoredCompEntry[]): string[] {
  const tickers = entries
    .map((entry) => entry.ticker?.trim() ?? "")
    .filter((ticker) => ticker.length > 0);
  return [...new Set(tickers)];
}

// Benchmark is Pro-only; entry/history is free.
async function benchmarkFor(
  userId: string,
  request: NextRequest
): Promise<{ isPro: boolean; marketRange: MarketRange | null }> {
  const plan = await PermissionMiddleware.getUserPlanInfo(userId);
  const params = new URL(request.url).searchParams;
  const marketRange = plan.isPro
    ? lookupMarketRange(params.get("roleFamily"), params.get("level"))
    : null;
  return { isPro: plan.isPro, marketRange };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: MESSAGES.unauthorized }, { status: 401 });

  const admin = createAdminClient();
  const listed = await listCompEntries(admin, user.id);
  if (!listed.ok) return domainErrorResponse(listed);

  const { isPro, marketRange } = await benchmarkFor(user.id, request);
  // Prices for the tickers this user tracks: cached by the daily cron and
  // refreshed live here when a ticker is new or its quote has gone stale, so a
  // just-added ticker gets a price on the first page load rather than tomorrow.
  const prices = await loadQuotes(admin, trackedTickers(listed.value));

  return NextResponse.json({
    entries: listed.value.map(toCompEntry),
    marketRange,
    isPro,
    prices,
    // Lets the page say why a ticker has no price: the feed is off, or the
    // symbol returned nothing from the feed.
    priceFeedEnabled: isPriceFeedConfigured(),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: MESSAGES.unauthorized }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: MESSAGES.invalidJson }, { status: 400 });
  }
  if (!isPlainObject(body)) {
    return NextResponse.json({ error: MESSAGES.bodyNotObject }, { status: 400 });
  }

  // external_ref is the agent idempotency key; the web form never sends one.
  const created = await createCompEntry(
    createAdminClient(),
    user.id,
    { ...body, external_ref: undefined },
    { source: MANUAL_SOURCE }
  );
  if (!created.ok) return domainErrorResponse(created);

  return NextResponse.json({ entry: toCompEntry(created.value.entry) }, { status: 201 });
}
