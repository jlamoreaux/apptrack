// @jest-environment node
/**
 * Tests for needsOnboardingBeforeConsent (lib/utils/user-onboarding.ts), the
 * strict new-account check the OAuth consent page uses:
 * - true only for an existing profile row, onboarding not completed, created
 *   inside the 5-minute window, no paid plan and no applications
 * - false for a missing row, a failed profile, subscription or applications
 *   query, a thrown error, a completed onboarding, an older account, a paid
 *   plan or any application
 * - isNewUser still treats a missing row as new (unchanged)
 */

import { createClient } from "@/lib/supabase/server";
import { isNewUser, needsOnboardingBeforeConsent } from "@/lib/utils/user-onboarding";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const mockCreateClient = createClient as jest.Mock;
const USER_ID = "11111111-2222-4333-8444-555555555555";

interface Result {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

interface Tables {
  profiles?: Result;
  user_subscriptions?: Result;
  applications?: Result;
}

function freshProfile(overrides: Record<string, unknown> = {}): Result {
  return {
    data: { onboarding_completed: false, created_at: new Date(Date.now() - 60 * 1000).toISOString(), ...overrides },
    error: null,
  };
}

const DEFAULT_TABLES: Required<Tables> = {
  profiles: freshProfile(),
  user_subscriptions: { data: null, error: null },
  applications: { count: 0, error: null },
};

/** A Supabase client whose every query on a table resolves to that table's result. */
function supabaseWith(tables: Tables = {}): { from: jest.Mock } {
  const results = { ...DEFAULT_TABLES, ...tables };
  const from = jest.fn((table: keyof Tables) => {
    const result = results[table];
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "order", "limit"]) query[method] = jest.fn(() => query);
    query.single = jest.fn(() => Promise.resolve(result));
    query.maybeSingle = jest.fn(() => Promise.resolve(result));
    query.then = (resolve: (value: Result) => void) => resolve(result);
    return query;
  });
  const client = { from };
  mockCreateClient.mockResolvedValue(client);
  return client;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("needsOnboardingBeforeConsent", () => {
  it("is true for a fresh account with a profile, no plan and no applications", async () => {
    supabaseWith();
    expect(await needsOnboardingBeforeConsent(USER_ID)).toBe(true);
  });

  it.each<[string, Tables]>([
    ["a missing profile row", { profiles: { data: null, error: null } }],
    ["a failed profile query", { profiles: { data: null, error: { message: "down" } } }],
    ["completed onboarding", { profiles: freshProfile({ onboarding_completed: true }) }],
    ["an account older than 5 minutes", { profiles: freshProfile({ created_at: new Date(Date.now() - 6 * 60 * 1000).toISOString() }) }],
    ["an unreadable created_at", { profiles: freshProfile({ created_at: null }) }],
    ["a paid plan", { user_subscriptions: { data: { subscription_plans: { name: "AI Coach" } }, error: null } }],
    ["a failed subscription query", { user_subscriptions: { data: null, error: { message: "down" } } }],
    ["an application", { applications: { count: 1, error: null } }],
    ["a failed applications query", { applications: { count: null, error: { message: "down" } } }],
  ])("is false for %s", async (_label, tables) => {
    supabaseWith(tables);
    expect(await needsOnboardingBeforeConsent(USER_ID)).toBe(false);
  });

  it("is false when the client can't be created", async () => {
    mockCreateClient.mockRejectedValue(new Error("no cookies"));
    expect(await needsOnboardingBeforeConsent(USER_ID)).toBe(false);
  });
});

describe("isNewUser (unchanged)", () => {
  it("still treats a missing profile row as new", async () => {
    supabaseWith({ profiles: { data: null, error: { message: "no rows" } } });
    expect(await isNewUser(USER_ID)).toBe(true);
  });
});
