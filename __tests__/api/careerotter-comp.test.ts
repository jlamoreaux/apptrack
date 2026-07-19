/**
 * Tests for the comp tracker API (M5):
 * - POST: auth, validation (date, base), success + comp_entered
 * - GET: benchmark is Pro-gated (marketRange null for Free), entries always returned
 */

import { GET, POST } from "@/app/api/careerotter/comp/route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";

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
function adminReturning(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ["from", "select", "insert", "eq", "order", "single", "maybeSingle"]) {
    b[m] = jest.fn(() => b);
  }
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  mockAdmin.mockReturnValue(b);
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
    adminReturning({ data: { id: "c1", base: 150000 }, error: null });
    const res = await POST(postReq({ effective_date: "2026-01-01", base: 150000, bonus: 20000 }));
    expect(res.status).toBe(201);
    expect(mockCapture).toHaveBeenCalledWith(
      USER.id,
      CAREEROTTER_EVENT_NAMES.COMP_ENTERED,
      expect.objectContaining({ total: 170000 })
    );
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
