/**
 * getCareerProfileContext (lib/careerotter/career-profile-service.ts):
 * scoped to user_id, null when absent, never throws, never leaks DB text.
 */

import {
  CAREER_PROFILE_CONTEXT_SELECT,
  getCareerProfileContext,
} from "@/lib/careerotter/career-profile-service";
import { loggerService } from "@/lib/services/logger.service";
import {
  expectScopedToUser,
  hasOp,
  mockSupabaseAdmin,
  throwingSupabaseAdmin,
} from "@/__tests__/utils/test-helpers/supabase-query-mock";

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const USER_ID = "8d0e7c1a-2b3c-4d5e-8f90-a1b2c3d4e5f6";
const SECRET_DB_TEXT = "relation career_profiles leaked detail";
const FAILED = { ok: false, kind: "db", message: "Failed to load career profile" };

const ROW = {
  mode: "raise",
  role: "Designer",
  level: null,
  time_in_role: null,
  target: "Senior Designer",
  review_date: "2027-01-15",
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getCareerProfileContext", () => {
  it("selects the context columns for the user", async () => {
    const admin = mockSupabaseAdmin([{ data: ROW }]);
    const result = await getCareerProfileContext(admin.client, USER_ID);
    expect(result).toEqual({ ok: true, value: ROW });
    expect(admin.queries[0].table).toBe("career_profiles");
    expect(hasOp(admin.queries[0], "select", CAREER_PROFILE_CONTEXT_SELECT)).toBe(true);
    expect(hasOp(admin.queries[0], "maybeSingle")).toBe(true);
    expectScopedToUser(admin.queries, USER_ID);
  });

  it("returns null when the user has no profile", async () => {
    const admin = mockSupabaseAdmin([{ data: null }]);
    expect(await getCareerProfileContext(admin.client, USER_ID)).toEqual({ ok: true, value: null });
  });

  it("logs and returns a generic failure on a query error", async () => {
    const admin = mockSupabaseAdmin([{ error: { message: SECRET_DB_TEXT } }]);
    const result = await getCareerProfileContext(admin.client, USER_ID);
    expect(result).toEqual(FAILED);
    expect(JSON.stringify(result)).not.toContain(SECRET_DB_TEXT);
    expect(loggerService.error).toHaveBeenCalled();
  });

  it("treats a malformed row as a failure", async () => {
    const admin = mockSupabaseAdmin([{ data: { ...ROW, mode: "sabbatical" } }]);
    expect(await getCareerProfileContext(admin.client, USER_ID)).toEqual(FAILED);
  });

  it("never throws", async () => {
    const admin = throwingSupabaseAdmin(SECRET_DB_TEXT);
    const result = await getCareerProfileContext(admin.client, USER_ID);
    expect(result).toEqual(FAILED);
    expect(loggerService.error).toHaveBeenCalled();
  });
});
