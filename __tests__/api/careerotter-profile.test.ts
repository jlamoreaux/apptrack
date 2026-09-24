/**
 * Tests for the career profile API. The goal frame used to be write-once at
 * onboarding, so the things Today asks for ("set your review date", "set up
 * your new role") had nowhere to go. These cover auth, validation, the
 * partial-update contract, and the insert-vs-update branch that keeps a PATCH
 * without `mode` from clobbering a stored one.
 */

import { GET, PATCH } from "@/app/api/careerotter/profile/route";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockCreateClient = createClient as jest.Mock;
const mockAdmin = createAdminClient as jest.Mock;

const USER = { id: "user-1", email: "u@example.com" };
const STORED = {
  mode: "promotion",
  role: "Software Engineer",
  level: "Senior",
  time_in_role: null,
  target: "Staff Engineer",
  review_date: "2026-12-01",
  zero_to_case_completed_at: null,
  starter_case: null,
};

function setUser(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  });
}

/**
 * A chainable Supabase builder stub. `existingRow` decides what the
 * "does this user already have a profile?" lookup finds; `result` is what the
 * write resolves to. Records the update/insert payloads for assertions.
 */
function adminStub({
  existingRow = { user_id: USER.id } as unknown,
  result = { data: STORED, error: null } as { data: unknown; error: unknown },
} = {}) {
  const calls = {
    update: [] as unknown[],
    insert: [] as unknown[],
    selectedColumns: [] as string[],
  };
  let isWrite = false;

  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.from = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(chain);
  builder.limit = jest.fn(chain);
  builder.select = jest.fn((columns: string) => {
    calls.selectedColumns.push(columns);
    return builder;
  });
  builder.update = jest.fn((payload: unknown) => {
    calls.update.push(payload);
    isWrite = true;
    return builder;
  });
  builder.insert = jest.fn((payload: unknown) => {
    calls.insert.push(payload);
    isWrite = true;
    return builder;
  });
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.maybeSingle = jest.fn(() =>
    Promise.resolve(isWrite ? result : { data: existingRow, error: null })
  );
  (builder as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve(result);

  mockAdmin.mockReturnValue(builder);
  return calls;
}

function patchReq(body: unknown, raw?: string) {
  return new NextRequest("http://localhost:3000/api/careerotter/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setUser(USER);
});

describe("GET /api/careerotter/profile", () => {
  it("401s without a session", async () => {
    setUser(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns the stored profile", async () => {
    // GET's only query is the maybeSingle lookup, which the stub answers with
    // `existingRow`.
    adminStub({ existingRow: STORED });
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ profile: STORED });
  });

  it("returns null rather than 404 for a user who never onboarded", async () => {
    adminStub({ existingRow: null, result: { data: null, error: null } });
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ profile: null });
  });
});

describe("PATCH /api/careerotter/profile", () => {
  it("401s without a session", async () => {
    setUser(null);
    const res = await PATCH(patchReq({ review_date: "2026-12-01" }));
    expect(res.status).toBe(401);
  });

  it("400s on a malformed body", async () => {
    const res = await PATCH(patchReq(null, "not json"));
    expect(res.status).toBe(400);
  });

  it("400s when there is nothing to update", async () => {
    const res = await PATCH(patchReq({}));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Nothing to update" });
  });

  it("rejects an unknown mode", async () => {
    const res = await PATCH(patchReq({ mode: "retirement" }));
    expect(res.status).toBe(400);
  });

  it("rejects a calendar-invalid review date", async () => {
    const res = await PATCH(patchReq({ review_date: "2026-02-30" }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-date review date", async () => {
    const res = await PATCH(patchReq({ review_date: "next quarter" }));
    expect(res.status).toBe(400);
  });

  it("updates only the fields supplied", async () => {
    const calls = adminStub();
    const res = await PATCH(patchReq({ review_date: "2027-03-01" }));
    expect(res.status).toBe(200);
    expect(calls.update).toEqual([{ review_date: "2027-03-01" }]);
    expect(calls.insert).toEqual([]);
  });

  it("never writes mode unless the caller sent one", async () => {
    const calls = adminStub();
    await PATCH(patchReq({ role: "Staff Engineer" }));
    expect(calls.update[0]).not.toHaveProperty("mode");
  });

  it("clears a field on an explicit null and on an empty string", async () => {
    const calls = adminStub();
    await PATCH(patchReq({ review_date: null, target: "" }));
    expect(calls.update).toEqual([{ target: null, review_date: null }]);
  });

  it("trims text fields", async () => {
    const calls = adminStub();
    await PATCH(patchReq({ role: "  Staff Engineer  " }));
    expect(calls.update).toEqual([{ role: "Staff Engineer" }]);
  });

  it("inserts a row for a user who has no profile yet", async () => {
    const calls = adminStub({ existingRow: null });
    const res = await PATCH(patchReq({ mode: "job_search", review_date: "2027-01-15" }));
    expect(res.status).toBe(200);
    expect(calls.insert).toEqual([
      { user_id: USER.id, mode: "job_search", review_date: "2027-01-15" },
    ]);
    expect(calls.update).toEqual([]);
  });

  it("500s when the write fails", async () => {
    adminStub({ result: { data: null, error: { message: "boom" } } });
    const res = await PATCH(patchReq({ review_date: "2027-03-01" }));
    expect(res.status).toBe(500);
  });
});
