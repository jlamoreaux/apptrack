/**
 * Tests for the promo case builder (M4):
 * - buildCasePrompt is grounded + first-person, uses the rubric
 * - POST route: 401 unauth, 403 Free, 422 too-few-wins, 200 Pro + case_exported
 */

import { POST } from "@/app/api/careerotter/case/route";
import { buildCasePrompt, CASE_RUBRIC_V1 } from "@/lib/careerotter/case-prompt";
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

// The route runs two awaited queries in Promise.all: wins then profile. Return
// wins for the first call and profile for the second.
function adminWith(wins: unknown, profile: unknown) {
  let call = 0;
  mockAdmin.mockReturnValue(
    new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (resolve: (v: unknown) => void) => {
              const result = call === 0 ? { data: wins, error: null } : { data: profile, error: null };
              call += 1;
              resolve(result);
            };
          }
          return () => mockAdmin();
        },
      }
    )
  );
}

describe("buildCasePrompt", () => {
  it("is grounded, first-person, and uses the rubric sections", () => {
    const p = buildCasePrompt({ mode: "promotion" }, [
      { text: "Shipped billing migration", tag: "delivery" },
    ]);
    expect(p).toMatch(/first-person/i);
    expect(p).toContain("Shipped billing migration");
    expect(p).toContain(CASE_RUBRIC_V1[0].split(":")[0]); // "Summary"
    expect(p).toMatch(/only the wins below|only evidence|do not invent/i);
  });
});

describe("POST /api/careerotter/case", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setUser(USER);
    mockPlan.mockResolvedValue({ isPro: true });
  });

  it("401 when unauthenticated", async () => {
    setUser(null);
    expect((await POST()).status).toBe(401);
  });

  it("403 for a Free user", async () => {
    mockPlan.mockResolvedValue({ isPro: false });
    expect((await POST()).status).toBe(403);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it("422 when there are too few wins", async () => {
    adminWith([{ text: "one" }], null);
    const res = await POST();
    expect(res.status).toBe(422);
    expect((await res.json()).needsMoreWins).toBe(true);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it("200 with markdown and fires case_exported when there is enough evidence", async () => {
    adminWith(
      [{ text: "a" }, { text: "b" }, { text: "c" }],
      { mode: "promotion" }
    );
    mockCall.mockResolvedValue("# My Case\n...");
    const res = await POST();
    expect(res.status).toBe(200);
    expect((await res.json()).markdown).toContain("My Case");
    expect(mockCapture).toHaveBeenCalledWith(
      USER.id,
      CAREEROTTER_EVENT_NAMES.CASE_EXPORTED,
      expect.objectContaining({ wins_used: 3 })
    );
  });
});
