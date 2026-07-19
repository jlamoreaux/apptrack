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

type OpResult = { data: unknown; error: unknown };
function chain(result: OpResult) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "maybeSingle", "single"]) b[m] = () => b;
  (b as { then: unknown }).then = (res: (v: OpResult) => void) => res(result);
  return b;
}
// Per-operation admin mock: the zero-to-case claim flow issues insert (claim),
// update (claim/save), and select (stored-case fetch) with different results.
function adminOps(ops: { insert?: OpResult; update?: OpResult; select?: OpResult }) {
  const none: OpResult = { data: null, error: null };
  mockCreateAdminClient.mockReturnValue({
    from: () => ({
      insert: () => chain(ops.insert ?? none),
      update: () => chain(ops.update ?? none),
      select: () => chain(ops.select ?? none),
    }),
  });
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
  adminOps({});
  const res = await POST(req({ mode: "world-domination" }));
  expect(res.status).toBe(400);
  expect(mockCallOpenAI).not.toHaveBeenCalled();
});

it("400 on a calendar-invalid review_date (2026-02-30)", async () => {
  adminOps({});
  const res = await POST(req({ mode: "promotion", review_date: "2026-02-30" }));
  expect(res.status).toBe(400);
  expect(mockCallOpenAI).not.toHaveBeenCalled();
});

it("is idempotent: returns the stored case without a new model call", async () => {
  // insert conflicts (row exists), claim-update flips nothing (already complete),
  // then the stored case is returned.
  adminOps({
    insert: { data: null, error: { code: "23505" } },
    update: { data: null, error: null },
    select: { data: { starter_case: "stored case" }, error: null },
  });
  const res = await POST(req({ mode: "promotion", wins: ["a"] }));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.starterCase).toBe("stored case");
  expect(json.alreadyCompleted).toBe(true);
  expect(mockCallOpenAI).not.toHaveBeenCalled();
});

it("generates a starter case, returns 201, and fires ztc_completed", async () => {
  // insert claims the run (row created); save-update succeeds.
  adminOps({
    insert: { data: { user_id: "user-1" }, error: null },
    update: { data: null, error: null },
  });
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
  adminOps({});
  const res = await POST(req({ mode: "promotion", review_date: "next tuesday" }));
  expect(res.status).toBe(400);
});
