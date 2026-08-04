/**
 * Comp tracker (CareerOtter Phase 2, M5).
 *
 * GET  /api/careerotter/comp?roleFamily=&level=  -> { entries, marketRange, isPro }
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
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: entries } = await admin
    .from("comp_entries")
    .select("id, effective_date, base, bonus, equity, currency, note, ticker, shares")
    .eq("user_id", user.id)
    .order("effective_date", { ascending: true });

  const plan = await PermissionMiddleware.getUserPlanInfo(user.id);
  const params = new URL(request.url).searchParams;
  const roleFamily = params.get("roleFamily");
  const level = params.get("level");
  // Benchmark is Pro-only; entry/history is free.
  const marketRange = plan.isPro ? lookupMarketRange(roleFamily, level) : null;

  // Live cached prices for the tickers this user tracks (feature is dark until the
  // polling cron populates stock_prices; absent tickers simply won't appear).
  const tickers = [
    ...new Set(
      (entries ?? [])
        .map((e) => (typeof e.ticker === "string" ? e.ticker.trim() : ""))
        .filter((t) => t.length > 0)
    ),
  ];
  const prices: Record<string, { price: number; as_of: string }> = {};
  if (tickers.length > 0) {
    const { data: priceRows } = await admin
      .from("stock_prices")
      .select("ticker, price, as_of")
      .in("ticker", tickers);
    for (const row of priceRows ?? []) {
      prices[row.ticker] = { price: Number(row.price), as_of: row.as_of };
    }
  }

  return NextResponse.json({
    entries: entries ?? [],
    marketRange,
    isPro: plan.isPro,
    prices,
  });
}

type PostBody = {
  effective_date?: unknown;
  base?: unknown;
  bonus?: unknown;
  equity?: unknown;
  note?: unknown;
  ticker?: unknown;
  shares?: unknown;
};

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: PostBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.effective_date !== "string" || !ISO_DATE.test(body.effective_date)) {
    return NextResponse.json(
      { error: "effective_date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }
  const base = num(body.base);
  if (base === null) {
    return NextResponse.json(
      { error: "base must be a non-negative number" },
      { status: 400 }
    );
  }
  const bonus = num(body.bonus) ?? 0;
  const equity = num(body.equity) ?? 0;
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;
  const ticker =
    typeof body.ticker === "string"
      ? body.ticker.trim().toUpperCase().slice(0, 10) || null
      : null;

  // shares is optional, but if supplied it must be a storable non-negative number.
  // numeric(14,4) tops out at 9,999,999,999.9999; reject rather than silently drop
  // an invalid value (num() would map -1 / "abc" to null and lose the input).
  const SHARES_MAX = 9_999_999_999.9999;
  let shares: number | null = null;
  if (body.shares !== undefined && body.shares !== null) {
    if (
      typeof body.shares !== "number" ||
      !Number.isFinite(body.shares) ||
      body.shares < 0 ||
      body.shares > SHARES_MAX
    ) {
      return NextResponse.json(
        { error: "shares must be a non-negative number no larger than 9,999,999,999.9999" },
        { status: 400 }
      );
    }
    shares = body.shares;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("comp_entries")
    .insert({
      user_id: user.id,
      effective_date: body.effective_date,
      base,
      bonus,
      equity,
      note,
      ticker,
      shares,
    })
    .select("id, effective_date, base, bonus, equity, currency, note, ticker, shares")
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
      total: base + bonus + equity,
    })
  );

  return NextResponse.json({ entry: data }, { status: 201 });
}
