/**
 * Tests for the comp tracker API (M5):
 * - POST: auth, validation (non-object body, date, base, ticker charset and
 *   length, amount caps, vest_years precision), total cap (429), success +
 *   comp_entered, generic 500 on a DB error
 * - GET: benchmark is Pro-gated (marketRange null for Free), entries always
 *   returned with the REST field list, 500 when the entries query errors
 * - DELETE: 404 for unknown and non-uuid ids
 */

import { GET, POST } from "@/app/api/careerotter/comp/route";
import { DELETE } from "@/app/api/careerotter/comp/[id]/route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { COMP_LIMITS } from "@/lib/constants/careerotter";
import { AGENT_WRITE_QUOTAS } from "@/lib/constants/agent-access";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/middleware/permissions", () => ({
  PermissionMiddleware: { getUserPlanInfo: jest.fn() },
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockCreateClient = createClient as jest.Mock;
const mockAdmin = createAdminClient as jest.Mock;
const mockPlan = PermissionMiddleware.getUserPlanInfo as jest.Mock;
const mockCapture = captureServerEvent as jest.Mock;

const USER = { id: "user-1", email: "u@example.com" };

function setUser(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  });
}
const ENTRY_ID = "11111111-2222-4333-8444-555555555555";

/** The fields GET/POST have always returned for an entry. */
const REST_FIELDS = [
  "id", "effective_date", "base", "bonus", "equity", "currency", "note",
  "ticker", "shares", "vest_start", "vest_years", "vest_cliff_months",
].sort();

function storedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: ENTRY_ID,
    effective_date: "2026-01-01",
    base: 150000,
    bonus: 20000,
    equity: 0,
    currency: "USD",
    note: null,
    ticker: null,
    shares: null,
    vest_start: null,
    vest_years: null,
    vest_cliff_months: null,
    source: "manual",
    external_ref: null,
    updated_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * Chainable admin-client mock: every `from()` builder is awaitable and resolves
 * to `result`. Records insert payloads so tests can inspect what was written.
 */
function adminReturning(result: { data: unknown; error: unknown; count?: number }) {
  const b: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "gte", "order", "single", "maybeSingle", "delete"]) {
    b[m] = jest.fn(() => b);
  }
  b.insert = jest.fn(() => b);
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  mockAdmin.mockReturnValue(b);
  return b;
}
function postReq(body: unknown) {
  return new NextRequest("http://localhost:3000/api/careerotter/comp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
function getReq(qs = "") {
  return new NextRequest(`http://localhost:3000/api/careerotter/comp${qs}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  setUser(USER);
  mockPlan.mockResolvedValue({ isPro: true });
});

describe("POST", () => {
  it("401 when unauthenticated", async () => {
    setUser(null);
    expect((await POST(postReq({ effective_date: "2026-01-01", base: 100 }))).status).toBe(401);
  });
  it("400 on a bad date", async () => {
    adminReturning({ data: null, error: null });
    expect((await POST(postReq({ effective_date: "jan", base: 100 }))).status).toBe(400);
  });
  it("400 when base is missing/negative", async () => {
    adminReturning({ data: null, error: null });
    expect((await POST(postReq({ effective_date: "2026-01-01", base: -5 }))).status).toBe(400);
  });
  it("201 + comp_entered on success", async () => {
    adminReturning({ data: storedRow(), error: null, count: 0 });
    const res = await POST(postReq({ effective_date: "2026-01-01", base: 150000, bonus: 20000 }));
    expect(res.status).toBe(201);
    expect(mockCapture).toHaveBeenCalledWith(
      USER.id,
      CAREEROTTER_EVENT_NAMES.COMP_ENTERED,
      expect.objectContaining({ total: 170000 })
    );
    const json = await res.json();
    expect(Object.keys(json.entry).sort()).toEqual(REST_FIELDS);
  });
  it("does not accept an external_ref from the web form", async () => {
    const admin = adminReturning({ data: storedRow(), error: null, count: 0 });
    await POST(postReq({ effective_date: "2026-01-01", base: 1, external_ref: "ref-1" }));
    expect(admin.insert).toHaveBeenCalledWith(
      expect.objectContaining({ external_ref: null, source: "manual" })
    );
  });
  it("400 on a ticker outside the charset", async () => {
    adminReturning({ data: null, error: null });
    const res = await POST(postReq({ effective_date: "2026-01-01", base: 1, ticker: "AB$C" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("ticker must be 1-10 letters, digits, dots or hyphens");
  });
  it("400 on an amount above numeric(12,2)", async () => {
    adminReturning({ data: null, error: null });
    const res = await POST(
      postReq({ effective_date: "2026-01-01", base: 1, equity: 10_000_000_000 })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("equity must be no larger than 9,999,999,999.99");
  });
  it.each([null, [], "base", 5])("400 (not 500) for a %p JSON body", async (body) => {
    const admin = adminReturning({ data: null, error: null });
    const res = await POST(postReq(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Request body must be a JSON object" });
    expect(admin.insert).not.toHaveBeenCalled();
  });
  it("400 on a ticker over the length cap (was truncated)", async () => {
    adminReturning({ data: null, error: null });
    const ticker = "A".repeat(COMP_LIMITS.tickerMax + 1);
    const res = await POST(postReq({ effective_date: "2026-01-01", base: 1, ticker }));
    expect(res.status).toBe(400);
  });
  it("400 on vest_years below numeric(4,2) precision", async () => {
    adminReturning({ data: null, error: null });
    const res = await POST(postReq({ effective_date: "2026-01-01", base: 1, vest_years: 0.005 }));
    expect(res.status).toBe(400);
  });
  it("429 when the user is at the total comp entry cap", async () => {
    const admin = adminReturning({ data: null, error: null, count: AGENT_WRITE_QUOTAS.compEntriesTotal });
    const res = await POST(postReq({ effective_date: "2026-01-01", base: 1 }));
    expect(res.status).toBe(429);
    expect(admin.insert).not.toHaveBeenCalled();
  });
  it("500 with a generic message when the insert fails", async () => {
    adminReturning({ data: null, error: { message: "relation does not exist" }, count: 0 });
    const res = await POST(postReq({ effective_date: "2026-01-01", base: 1 }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to save comp entry" });
  });
});

describe("GET entries", () => {
  it("returns entries with exactly the REST field list", async () => {
    adminReturning({ data: [storedRow({ source: "agent", external_ref: "ref-1" })], error: null });
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.entries).toHaveLength(1);
    expect(Object.keys(json.entries[0]).sort()).toEqual(REST_FIELDS);
  });

  it("500 when the entries query errors (was 200 with [])", async () => {
    adminReturning({ data: null, error: { message: "boom" } });
    const res = await GET(getReq());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to load comp entries" });
  });
});

describe("DELETE", () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const delReq = () =>
    new NextRequest(`http://localhost:3000/api/careerotter/comp/${ENTRY_ID}`, { method: "DELETE" });

  it("401 when unauthenticated", async () => {
    setUser(null);
    expect((await DELETE(delReq(), params(ENTRY_ID))).status).toBe(401);
  });
  it("200 when the caller's row is deleted", async () => {
    adminReturning({ data: { id: ENTRY_ID }, error: null });
    const res = await DELETE(delReq(), params(ENTRY_ID));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });
  it("404 when no row matched", async () => {
    adminReturning({ data: null, error: null });
    const res = await DELETE(delReq(), params(ENTRY_ID));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Comp entry not found" });
  });
  it("404 for a non-uuid id (was 500)", async () => {
    adminReturning({ data: null, error: { message: "invalid input syntax for type uuid" } });
    const res = await DELETE(delReq(), params("not-a-uuid"));
    expect(res.status).toBe(404);
    expect(mockAdmin().from).not.toHaveBeenCalled();
  });
  it("500 with a generic message on a DB error", async () => {
    adminReturning({ data: null, error: { message: "boom" } });
    const res = await DELETE(delReq(), params(ENTRY_ID));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to delete comp entry" });
  });
});

describe("GET benchmark gating", () => {
  it("returns a market range for Pro with a known role/level", async () => {
    mockPlan.mockResolvedValue({ isPro: true });
    adminReturning({ data: [], error: null });
    const res = await GET(getReq("?roleFamily=software_engineer&level=senior"));
    const json = await res.json();
    expect(json.marketRange).not.toBeNull();
    expect(json.isPro).toBe(true);
  });

  it("withholds the benchmark for Free (marketRange null)", async () => {
    mockPlan.mockResolvedValue({ isPro: false });
    adminReturning({ data: [], error: null });
    const res = await GET(getReq("?roleFamily=software_engineer&level=senior"));
    const json = await res.json();
    expect(json.marketRange).toBeNull();
    expect(json.isPro).toBe(false);
  });
});
