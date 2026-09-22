/**
 * Comp tracker (CareerOtter Phase 2, M5).
 *
 * GET  /api/careerotter/comp?roleFamily=&level=  -> { entries, marketRange, isPro, prices, priceFeedEnabled }
 * POST /api/careerotter/comp                      -> add a comp entry
 *
 * Tracking your own numbers is free. The market benchmark (the "market-vs-you"
 * intelligence, D2) is the Pro value-add, so marketRange is only returned for
 * Pro. No fabricated ranges: if there's no curated data for the role/level,
 * marketRange is null and the UI shows own-history only.
 */

import { type NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { lookupMarketRange } from "@/lib/careerotter/market-data";
import { isPriceFeedConfigured } from "@/lib/careerotter/stock-price";
import { loadQuotes } from "@/lib/careerotter/stock-price-cache";
import { normalizeTickers } from "@/lib/careerotter/tickers";
import { validateCompEntryInput } from "@/lib/careerotter/comp-entry-validation";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: entries } = await admin
    .from("comp_entries")
    .select(
      "id, effective_date, base, bonus, equity, currency, note, ticker, shares, vest_start, vest_years, vest_cliff_months"
    )
    .eq("user_id", user.id)
    .order("effective_date", { ascending: true });

  const plan = await PermissionMiddleware.getUserPlanInfo(user.id);
  const params = new URL(request.url).searchParams;
  const roleFamily = params.get("roleFamily");
  const level = params.get("level");
  // Benchmark is Pro-only; entry/history is free.
  const marketRange = plan.isPro ? lookupMarketRange(roleFamily, level) : null;

  // Prices for the tickers this user tracks: cached by the daily cron and
  // refreshed live here when a ticker is new or its quote has gone stale, so a
  // just-added ticker gets a price on the first page load rather than tomorrow.
  const tickers = normalizeTickers((entries ?? []).map((e) => e.ticker));
  const prices = await loadQuotes(admin, tickers);

  return NextResponse.json({
    entries: entries ?? [],
    marketRange,
    isPro: plan.isPro,
    prices,
    // Lets the page say why a ticker has no price: the feed is off, or the
    // symbol returned nothing from the feed.
    priceFeedEnabled: isPriceFeedConfigured(),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // The same validator the entry form and the guest cache use, so nothing a
  // guest saved before signing up can be rejected here on import.
  const checked = validateCompEntryInput(body);
  if (!checked.ok) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }
  const { value, note } = checked;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("comp_entries")
    .insert({
      user_id: user.id,
      ...value,
      note,
    })
    .select(
      "id, effective_date, base, bonus, equity, currency, note, ticker, shares, vest_start, vest_years, vest_cliff_months"
    )
    .single();

  if (error) {
    loggerService.error("Failed to add comp entry", error, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "comp_entry_failed",
    });
    return NextResponse.json({ error: "Failed to save comp entry" }, { status: 500 });
  }

  after(
    captureServerEvent(user.id, CAREEROTTER_EVENT_NAMES.COMP_ENTERED, {
      total: value.base + value.bonus + value.equity,
    })
  );

  return NextResponse.json({ entry: data }, { status: 201 });
}
