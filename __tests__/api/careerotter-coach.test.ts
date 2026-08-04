/**
 * Tests for POST /api/careerotter/coach (M3):
 * - 401 unauth, 403 for Free (Pro-gated), 400 bad messages, 200 for Pro
 * - the reply comes back and coach_message_sent fires
 */

import { POST } from "@/app/api/careerotter/coach/route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { callOpenAI } from "@/lib/openai/client";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/openai/client", () => ({ callOpenAI: jest.fn() }));
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
const mockCall = callOpenAI as jest.Mock;
const mockCapture = captureServerEvent as jest.Mock;

const USER = { id: "user-1", email: "u@example.com" };

function setUser(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  });
}

function adminReturning(result: { data: unknown; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const m of ["from", "select", "eq", "order", "maybeSingle"]) b[m] = jest.fn(() => b);
  (b as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result);
  mockAdmin.mockReturnValue(b);
}

function req(body: unknown) {
  return new NextRequest("http://localhost:3000/api/careerotter/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const USER_MSG = { messages: [{ role: "user", content: "am i ready?" }] };

beforeEach(() => {
  jest.clearAllMocks();
  setUser(USER);
  mockPlan.mockResolvedValue({ isPro: true });
  adminReturning({ data: [], error: null });
});

it("401 when unauthenticated", async () => {
  setUser(null);
  expect((await POST(req(USER_MSG))).status).toBe(401);
});

it("403 for a Free user (Pro-gated)", async () => {
  mockPlan.mockResolvedValue({ isPro: false });
  const res = await POST(req(USER_MSG));
  expect(res.status).toBe(403);
  expect(mockCall).not.toHaveBeenCalled();
});

it("400 when messages are empty or malformed", async () => {
  expect((await POST(req({ messages: [] }))).status).toBe(400);
  expect((await POST(req({ messages: [{ role: "assistant", content: "hi" }] }))).status).toBe(400);
});

it("returns the reply and fires coach_message_sent for a Pro user", async () => {
  mockCall.mockResolvedValue("Take the Q3 postmortem and log it.");
  const res = await POST(req(USER_MSG));
  expect(res.status).toBe(200);
  expect((await res.json()).reply).toBe("Take the Q3 postmortem and log it.");
  expect(mockCapture).toHaveBeenCalledWith(
    USER.id,
    CAREEROTTER_EVENT_NAMES.COACH_MESSAGE_SENT,
    expect.objectContaining({ turns: 1 })
  );
});

it("502 when the model call fails", async () => {
  mockCall.mockRejectedValue(new Error("model down"));
  expect((await POST(req(USER_MSG))).status).toBe(502);
});
