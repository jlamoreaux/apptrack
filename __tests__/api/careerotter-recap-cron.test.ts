/**
 * Tests for the weekly recap cron's wins loader:
 * - more than one page of wins is fully grouped across users
 * - a query error on a later page returns 500
 * - a single short page behaves as before (one range call, recaps stored)
 */

import { GET } from "@/app/api/cron/careerotter-recap/route";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { verifyCronAuth } from "@/lib/email/lifecycle-cron";
import { callOpenAI } from "@/lib/openai/client";

jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/email/lifecycle-cron", () => ({ verifyCronAuth: jest.fn() }));
jest.mock("@/lib/openai/client", () => ({ callOpenAI: jest.fn() }));
jest.mock("@/lib/careerotter/week-start", () => ({ weekStartOf: jest.fn(() => "2026-09-21") }));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockAdmin = createAdminClient as jest.Mock;
const mockAuth = verifyCronAuth as jest.Mock;
const mockOpenAI = callOpenAI as jest.Mock;

const PAGE_SIZE = 1000;

interface WinRow {
  user_id: string;
  text: string;
  tag: string | null;
  impact_number: string | null;
}

interface PageResult {
  data: WinRow[] | null;
  error: { message: string } | null;
}

function win(userId: string, n: number): WinRow {
  return { user_id: userId, text: `win ${n}`, tag: null, impact_number: null };
}

/**
 * Admin mock: the `wins` builder resolves each `.range()` call to the next
 * queued page; `weekly_recaps.upsert` always succeeds.
 */
function adminWithPages(pages: PageResult[]) {
  const queue = [...pages];
  const winsBuilder: Record<string, jest.Mock> = {};
  for (const m of ["select", "gte", "order"]) {
    winsBuilder[m] = jest.fn(() => winsBuilder);
  }
  winsBuilder.range = jest.fn(() => Promise.resolve(queue.shift() ?? { data: [], error: null }));
  const upsert = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn((table: string) => (table === "wins" ? winsBuilder : { upsert }));
  mockAdmin.mockReturnValue({ from });
  return { winsBuilder, upsert };
}

function cronReq(): NextRequest {
  return new NextRequest("http://localhost/api/cron/careerotter-recap", {
    headers: { authorization: "Bearer secret" },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockReturnValue(true);
  mockOpenAI.mockResolvedValue("recap text");
});

describe("GET /api/cron/careerotter-recap wins pagination", () => {
  it("loads every page and groups wins across users", async () => {
    // First page: user-a fills it entirely; second page is short and spans two users.
    const firstPage = Array.from({ length: PAGE_SIZE }, (_, i) => win("user-a", i));
    const secondPage = [win("user-a", 1000), win("user-b", 1), win("user-c", 1)];
    const { winsBuilder, upsert } = adminWithPages([
      { data: firstPage, error: null },
      { data: secondPage, error: null },
    ]);

    const res = await GET(cronReq());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(winsBuilder.range).toHaveBeenCalledTimes(2);
    expect(winsBuilder.range).toHaveBeenNthCalledWith(1, 0, PAGE_SIZE - 1);
    expect(winsBuilder.range).toHaveBeenNthCalledWith(2, PAGE_SIZE, 2 * PAGE_SIZE - 1);
    expect(winsBuilder.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(winsBuilder.order).toHaveBeenCalledWith("id", { ascending: true });

    expect(body).toEqual({ weekStart: "2026-09-21", eligibleUsers: 3, generated: 3 });
    const included = Object.fromEntries(
      upsert.mock.calls.map(([row]: [{ user_id: string; wins_included: number }]) => [
        row.user_id,
        row.wins_included,
      ])
    );
    expect(included).toEqual({ "user-a": PAGE_SIZE + 1, "user-b": 1, "user-c": 1 });
  });

  it("returns 500 when a later page errors", async () => {
    const firstPage = Array.from({ length: PAGE_SIZE }, (_, i) => win("user-a", i));
    const { winsBuilder, upsert } = adminWithPages([
      { data: firstPage, error: null },
      { data: null, error: { message: "boom" } },
    ]);

    const res = await GET(cronReq());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "query failed" });
    expect(winsBuilder.range).toHaveBeenCalledTimes(2);
    expect(upsert).not.toHaveBeenCalled();
    expect(mockOpenAI).not.toHaveBeenCalled();
  });

  it("stops after a single short page", async () => {
    const { winsBuilder, upsert } = adminWithPages([
      { data: [win("user-a", 1), win("user-a", 2), win("user-b", 1)], error: null },
    ]);

    const res = await GET(cronReq());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ weekStart: "2026-09-21", eligibleUsers: 2, generated: 2 });
    expect(winsBuilder.range).toHaveBeenCalledTimes(1);
    expect(winsBuilder.range).toHaveBeenCalledWith(0, PAGE_SIZE - 1);
    expect(upsert).toHaveBeenCalledTimes(2);
  });
});
