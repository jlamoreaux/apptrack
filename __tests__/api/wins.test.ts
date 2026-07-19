/**
 * Tests for the wins API (CareerOtter Phase 2, M2):
 * - auth (401), validation (missing text, bad tag, over-length), success (201)
 * - GET lists the user's wins
 * - PATCH/DELETE are scoped to the owner (404 when the row isn't theirs)
 * - a server-authoritative win_logged event fires on create
 */

import { GET, POST } from "@/app/api/wins/route";
import { PATCH, DELETE } from "@/app/api/wins/[id]/route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
// next/server (NextRequest/NextResponse/after) is mocked globally in jest.setup.js.

const mockCreateClient = createClient as jest.Mock;
const mockCreateAdminClient = createAdminClient as jest.Mock;
const mockCapture = captureServerEvent as jest.Mock;

const USER = { id: "user-1", email: "u@example.com" };

function setUser(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  });
}

/**
 * Chainable Supabase-query mock: every builder method returns the builder, and
 * the builder is awaitable (resolves to `result`). Covers both
 * `.select().eq().order()` and `.insert().select().single()` shapes.
 */
function adminReturning(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const methods = [
    "from", "select", "insert", "update", "delete", "eq", "order",
    "single", "maybeSingle",
  ];
  for (const m of methods) builder[m] = jest.fn(() => builder);
  (builder as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve(result);
  mockCreateAdminClient.mockReturnValue(builder);
  return builder;
}

function req(body: unknown, method = "POST") {
  return new NextRequest("http://localhost:3000/api/wins", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setUser(USER);
});

describe("POST /api/wins", () => {
  it("401 when unauthenticated", async () => {
    setUser(null);
    const res = await POST(req({ text: "shipped it" }));
    expect(res.status).toBe(401);
  });

  it("400 when text is missing", async () => {
    adminReturning({ data: null, error: null });
    const res = await POST(req({ tag: "delivery" }));
    expect(res.status).toBe(400);
  });

  it("400 on an invalid tag", async () => {
    adminReturning({ data: null, error: null });
    const res = await POST(req({ text: "shipped it", tag: "wizardry" }));
    expect(res.status).toBe(400);
  });

  it("400 when text exceeds the cap", async () => {
    adminReturning({ data: null, error: null });
    const res = await POST(req({ text: "x".repeat(2001) }));
    expect(res.status).toBe(400);
  });

  it("201 on success and fires win_logged", async () => {
    const win = { id: "w1", text: "shipped it", tag: "delivery", source: "manual" };
    adminReturning({ data: win, error: null });
    const res = await POST(req({ text: "shipped it", tag: "delivery" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.win).toEqual(win);
    expect(mockCapture).toHaveBeenCalledWith(
      USER.id,
      CAREEROTTER_EVENT_NAMES.WIN_LOGGED,
      expect.objectContaining({ tag: "delivery", source: "manual" })
    );
  });

  it("ignores a forged source and records manual", async () => {
    adminReturning({ data: { id: "w1", text: "x", source: "manual" }, error: null });
    const res = await POST(req({ text: "x", source: "zero_to_case" }));
    expect(res.status).toBe(201);
    // Server-authoritative provenance: the event (and insert) use "manual".
    expect(mockCapture).toHaveBeenCalledWith(
      USER.id,
      CAREEROTTER_EVENT_NAMES.WIN_LOGGED,
      expect.objectContaining({ source: "manual" })
    );
  });
});

describe("GET /api/wins", () => {
  it("returns the user's wins", async () => {
    const wins = [{ id: "w1", text: "a" }, { id: "w2", text: "b" }];
    adminReturning({ data: wins, error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).wins).toEqual(wins);
  });

  it("401 when unauthenticated", async () => {
    setUser(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("PATCH/DELETE /api/wins/:id", () => {
  const ctx = { params: Promise.resolve({ id: "w1" }) };

  it("404 when the win isn't the caller's (no row returned)", async () => {
    adminReturning({ data: null, error: { code: "PGRST116" } });
    const res = await PATCH(req({ text: "edited" }, "PATCH"), ctx);
    expect(res.status).toBe(404);
  });

  it("updates an owned win", async () => {
    const win = { id: "w1", text: "edited", tag: null, source: "manual" };
    adminReturning({ data: win, error: null });
    const res = await PATCH(req({ text: "edited" }, "PATCH"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).win.text).toBe("edited");
  });

  it("400 on a PATCH with no editable fields (no phantom edited_at bump)", async () => {
    adminReturning({ data: null, error: null });
    const res = await PATCH(req({}, "PATCH"), ctx);
    expect(res.status).toBe(400);
  });

  it("500 (not 404) when the PATCH hits a real DB error", async () => {
    adminReturning({ data: null, error: { code: "08006", message: "connection failure" } });
    const res = await PATCH(req({ text: "edited" }, "PATCH"), ctx);
    expect(res.status).toBe(500);
  });

  it("404 deleting a win that isn't the caller's", async () => {
    adminReturning({ data: null, error: null });
    const res = await DELETE(req({}, "DELETE"), ctx);
    expect(res.status).toBe(404);
  });

  it("deletes an owned win", async () => {
    adminReturning({ data: { id: "w1" }, error: null });
    const res = await DELETE(req({}, "DELETE"), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
