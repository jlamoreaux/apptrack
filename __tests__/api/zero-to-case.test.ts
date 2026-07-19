/**
 * Tests for POST /api/careerotter/zero-to-case (M2 activation).
 * - auth (401), mode validation (400)
 * - idempotent: an already-completed profile returns the stored case and does
 *   NOT spend another model call
 * - success: generates via the model, returns 201, fires ztc_completed
 */

import { POST } from "@/app/api/careerotter/zero-to-case/route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { callOpenAI } from "@/lib/openai/client";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/openai/client", () => ({ callOpenAI: jest.fn() }));
jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
// next/server (NextRequest/NextResponse/after) is mocked globally in jest.setup.js.

const mockCreateClient = createClient as jest.Mock;
const mockCreateAdminClient = createAdminClient as jest.Mock;
const mockCallOpenAI = callOpenAI as jest.Mock;
const mockCapture = captureServerEvent as jest.Mock;

const USER = { id: "user-1", email: "u@example.com" };

function setUser(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  });
}

function adminReturning(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const m of ["from", "select", "insert", "update", "upsert", "eq", "maybeSingle", "single"]) {
    builder[m] = jest.fn(() => builder);
  }
  (builder as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  mockCreateAdminClient.mockReturnValue(builder);
}

function req(body: unknown) {
  return new NextRequest("http://localhost:3000/api/careerotter/zero-to-case", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setUser(USER);
});

it("401 when unauthenticated", async () => {
  setUser(null);
  const res = await POST(req({ mode: "promotion" }));
  expect(res.status).toBe(401);
});

it("400 on an invalid mode", async () => {
  adminReturning({ data: null, error: null });
  const res = await POST(req({ mode: "world-domination" }));
  expect(res.status).toBe(400);
  expect(mockCallOpenAI).not.toHaveBeenCalled();
});

it("is idempotent: returns the stored case without a new model call", async () => {
  adminReturning({
    data: {
      zero_to_case_completed_at: "2026-07-01T00:00:00Z",
      starter_case: "stored case",
      mode: "promotion",
    },
    error: null,
  });
  const res = await POST(req({ mode: "promotion", wins: ["a"] }));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.starterCase).toBe("stored case");
  expect(json.alreadyCompleted).toBe(true);
  expect(mockCallOpenAI).not.toHaveBeenCalled();
});

it("generates a starter case, returns 201, and fires ztc_completed", async () => {
  adminReturning({ data: null, error: null }); // no existing profile; upserts ok
  mockCallOpenAI.mockResolvedValue("your generated starter case");

  const res = await POST(
    req({
      mode: "raise",
      role: "Staff Engineer",
      review_date: "2026-09-14",
      wins: ["shipped billing migration", "unblocked data team"],
    })
  );

  expect(res.status).toBe(201);
  const json = await res.json();
  expect(json.starterCase).toBe("your generated starter case");
  expect(json.alreadyCompleted).toBe(false);
  expect(mockCallOpenAI).toHaveBeenCalledTimes(1);
  expect(mockCapture).toHaveBeenCalledWith(
    USER.id,
    CAREEROTTER_EVENT_NAMES.ZTC_COMPLETED,
    expect.objectContaining({ mode: "raise", wins_seeded: 2, has_review_date: true })
  );
});

it("400 on an invalid review_date format", async () => {
  adminReturning({ data: null, error: null });
  const res = await POST(req({ mode: "promotion", review_date: "next tuesday" }));
  expect(res.status).toBe(400);
});
