/**
 * Tests for the wins domain service (lib/careerotter/wins-service.ts):
 * - validation rules for REST fields and agent-only fields
 * - duplicate external_ref handling (constraint-name check, vanished row)
 * - agent quota, onlySource filtering, user_id scoping on every query
 * - never throws, and never leaks database error text
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  WIN_AGENT_SELECT,
  WIN_REST_SELECT,
  createWin,
  deleteWin,
  listWins,
  updateWin,
  validateWinInput,
  validateWinPatch,
  type WinInput,
} from "@/lib/careerotter/wins-service";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { loggerService } from "@/lib/services/logger.service";
import {
  EVIDENCE_URL_MAX,
  EXTERNAL_REF_MAX,
  WIN_LIMITS,
} from "@/lib/constants/careerotter";
import { AGENT_WRITE_QUOTAS } from "@/lib/constants/agent-access";

jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
// next/server (after) is mocked globally in jest.setup.js.

const mockCapture = captureServerEvent as jest.Mock;
const mockLogError = loggerService.error as jest.Mock;

const USER_ID = "8d0e7c1a-2b3c-4d5e-8f90-a1b2c3d4e5f6";
const WIN_ID = "3f1c2a4e-8b7d-4c6a-9e2f-1a2b3c4d5e6f";
const SECRET_DB_TEXT = "relation wins leaked internal detail";

interface QueryResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

type Builder = Record<string, jest.Mock>;

const BUILDER_METHODS = [
  "select", "insert", "update", "delete", "eq", "gte", "lte", "order",
  "limit", "single", "maybeSingle",
];

/**
 * Chainable Supabase-query mock. Each `from()` starts a new builder that
 * resolves to the next queued result, so multi-query paths (quota count, then
 * insert, then lookup) can be scripted and each query's calls inspected.
 */
function mockAdmin(results: QueryResult[]) {
  const queue = [...results];
  const builders: Builder[] = [];
  const from = jest.fn(() => {
    const result = { data: null, error: null, ...queue.shift() };
    const builder: Builder = {};
    for (const method of BUILDER_METHODS) builder[method] = jest.fn(() => builder);
    Object.assign(builder, {
      then: (resolve: (value: unknown) => void) => resolve(result),
    });
    builders.push(builder);
    return builder;
  });
  // The service only uses from() and the builder chain mocked above.
  const admin = { from } as unknown as SupabaseClient;
  return { admin, from, builders };
}

function throwingAdmin(): SupabaseClient {
  const from = jest.fn(() => {
    throw new Error(SECRET_DB_TEXT);
  });
  return { from } as unknown as SupabaseClient;
}

function expectScopedToUser(builders: Builder[]): void {
  for (const builder of builders) {
    const scoped =
      builder.eq.mock.calls.some(([col, val]) => col === "user_id" && val === USER_ID) ||
      builder.insert.mock.calls.some(([row]) => row.user_id === USER_ID);
    expect(scoped).toBe(true);
  }
}

function isoDateFromToday(daysAhead: number): string {
  const msPerDay = 24 * 60 * 60 * 1000;
  return new Date(Date.now() + daysAhead * msPerDay).toISOString().slice(0, 10);
}

function validationMessage(result: { ok: boolean; kind?: string; message?: string }) {
  expect(result.ok).toBe(false);
  expect(result.kind).toBe("validation");
  return result.message;
}

const REST = { allowAgentFields: false };
const AGENT = { allowAgentFields: true };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("validateWinInput — REST fields", () => {
  it("requires text (missing, blank, or non-string)", () => {
    for (const text of [undefined, "   ", 42]) {
      expect(validationMessage(validateWinInput({ text }, REST))).toBe("Win text is required");
    }
  });

  it("treats a non-object body as missing text", () => {
    expect(validationMessage(validateWinInput(null, REST))).toBe("Win text is required");
  });

  it("trims text and enforces the cap", () => {
    const ok = validateWinInput({ text: `  ${"x".repeat(WIN_LIMITS.textMax)}  ` }, REST);
    expect(ok.ok && ok.value.text.length).toBe(WIN_LIMITS.textMax);
    expect(validationMessage(validateWinInput({ text: "x".repeat(WIN_LIMITS.textMax + 1) }, REST)))
      .toBe(`Win text must be ${WIN_LIMITS.textMax} characters or fewer`);
  });

  it("trims and truncates impact_number instead of rejecting it", () => {
    const result = validateWinInput(
      { text: "a", impact_number: `  ${"9".repeat(WIN_LIMITS.impactNumberMax + 10)}` },
      REST
    );
    expect(result.ok && result.value.impact_number).toBe("9".repeat(WIN_LIMITS.impactNumberMax));
  });

  it("maps an empty or null impact_number to null and rejects non-strings", () => {
    for (const impact_number of ["", null, undefined]) {
      const result = validateWinInput({ text: "a", impact_number }, REST);
      expect(result.ok && result.value.impact_number).toBeNull();
    }
    expect(validationMessage(validateWinInput({ text: "a", impact_number: 5 }, REST)))
      .toBe("impact_number must be a string");
  });

  it("accepts a known tag, nulls an empty one, rejects others", () => {
    const tagged = validateWinInput({ text: "a", tag: "delivery" }, REST);
    expect(tagged.ok && tagged.value.tag).toBe("delivery");
    for (const tag of ["", null]) {
      const result = validateWinInput({ text: "a", tag }, REST);
      expect(result.ok && result.value.tag).toBeNull();
    }
    expect(validationMessage(validateWinInput({ text: "a", tag: "wizardry" }, REST))).toBe("Invalid tag");
  });

  it("ignores agent-only fields unless allowed", () => {
    const result = validateWinInput(
      { text: "a", occurred_at: "not-a-date", evidence_url: "javascript:x", external_ref: "" },
      REST
    );
    expect(result).toEqual({ ok: true, value: { text: "a", impact_number: null, tag: null } });
  });
});

describe("validateWinInput — agent fields", () => {
  it("accepts all agent fields when valid", () => {
    const result = validateWinInput(
      {
        text: "a",
        occurred_at: "2024-02-29",
        evidence_url: " https://example.com/pr/1 ",
        external_ref: "  gh:pr:1  ",
      },
      AGENT
    );
    expect(result).toEqual({
      ok: true,
      value: {
        text: "a",
        impact_number: null,
        tag: null,
        occurred_at: "2024-02-29",
        evidence_url: "https://example.com/pr/1",
        external_ref: "gh:pr:1",
      },
    });
  });

  it("leaves absent agent fields unset", () => {
    const result = validateWinInput({ text: "a" }, AGENT);
    expect(result).toEqual({ ok: true, value: { text: "a", impact_number: null, tag: null } });
  });

  it.each(["2023-02-29", "2024-13-01", "2024-1-01", "01/02/2024", 20240101])(
    "rejects occurred_at %p that is not a real YYYY-MM-DD date",
    (occurred_at) => {
      expect(validationMessage(validateWinInput({ text: "a", occurred_at }, AGENT)))
        .toBe("occurred_at must be a date in YYYY-MM-DD format");
    }
  );

  it("rejects occurred_at before 1970-01-01 and accepts the boundary", () => {
    expect(validationMessage(validateWinInput({ text: "a", occurred_at: "1969-12-31" }, AGENT)))
      .toBe("occurred_at must be on or after 1970-01-01");
    expect(validateWinInput({ text: "a", occurred_at: "1970-01-01" }, AGENT).ok).toBe(true);
  });

  it("allows occurred_at up to one day ahead of UTC today, not two", () => {
    expect(validateWinInput({ text: "a", occurred_at: isoDateFromToday(1) }, AGENT).ok).toBe(true);
    expect(validationMessage(validateWinInput({ text: "a", occurred_at: isoDateFromToday(2) }, AGENT)))
      .toBe("occurred_at cannot be in the future");
  });

  it.each(["javascript:alert(1)", "ftp://example.com/x", "data:text/html,hi", "not a url", 7])(
    "rejects evidence_url %p",
    (evidence_url) => {
      expect(validationMessage(validateWinInput({ text: "a", evidence_url }, AGENT)))
        .toBe("evidence_url must be an http or https URL");
    }
  );

  it("accepts http evidence_url and rejects one over the length cap", () => {
    expect(validateWinInput({ text: "a", evidence_url: "http://example.com" }, AGENT).ok).toBe(true);
    const tooLong = `https://example.com/${"a".repeat(EVIDENCE_URL_MAX)}`;
    expect(validationMessage(validateWinInput({ text: "a", evidence_url: tooLong }, AGENT)))
      .toBe(`evidence_url must be ${EVIDENCE_URL_MAX} characters or fewer`);
  });

  it("enforces external_ref length 1..max after trimming", () => {
    const message = `external_ref must be a string of 1 to ${EXTERNAL_REF_MAX} characters`;
    for (const external_ref of ["", "   ", "r".repeat(EXTERNAL_REF_MAX + 1), 12]) {
      expect(validationMessage(validateWinInput({ text: "a", external_ref }, AGENT))).toBe(message);
    }
    expect(validateWinInput({ text: "a", external_ref: "r".repeat(EXTERNAL_REF_MAX) }, AGENT).ok)
      .toBe(true);
  });
});

describe("validateWinPatch", () => {
  it("rejects a patch with no editable field", () => {
    expect(validationMessage(validateWinPatch({}, REST))).toBe("No editable fields provided");
  });

  it("does not count agent fields as editable on the REST path", () => {
    expect(validationMessage(validateWinPatch({ occurred_at: "2024-01-01" }, REST)))
      .toBe("No editable fields provided");
  });

  it("clears impact_number, tag and evidence_url with null", () => {
    expect(validateWinPatch({ impact_number: null, tag: "", evidence_url: null }, AGENT)).toEqual({
      ok: true,
      value: { impact_number: null, tag: null, evidence_url: null },
    });
  });

  it("validates text on edit", () => {
    expect(validationMessage(validateWinPatch({ text: "  " }, REST))).toBe("Win text is required");
  });
});

describe("createWin", () => {
  const input: WinInput = { text: "shipped it", impact_number: null, tag: null };
  const stored = { id: WIN_ID, text: "shipped it", source: "manual" };

  it("inserts a manual win with no quota query and fires win_logged", async () => {
    const { admin, builders } = mockAdmin([{ data: stored }]);
    const result = await createWin(admin, USER_ID, input, { source: "manual" });

    expect(result).toEqual({ ok: true, value: { win: stored, duplicate: false } });
    expect(builders).toHaveLength(1);
    expect(builders[0].insert).toHaveBeenCalledWith({ user_id: USER_ID, ...input, source: "manual" });
    expect(builders[0].select).toHaveBeenCalledWith(WIN_REST_SELECT);
    expect(mockCapture).toHaveBeenCalledWith(USER_ID, CAREEROTTER_EVENT_NAMES.WIN_LOGGED, {
      tag: "untagged",
      source: "manual",
    });
  });

  it("uses the given distinct id and select list", async () => {
    const { admin, builders } = mockAdmin([{ count: 0 }, { data: stored }]);
    await createWin(admin, USER_ID, { ...input, tag: "craft" }, {
      source: "agent",
      select: WIN_AGENT_SELECT,
      distinctId: "distinct-1",
    });
    expect(builders[1].select).toHaveBeenCalledWith(WIN_AGENT_SELECT);
    expect(mockCapture).toHaveBeenCalledWith("distinct-1", CAREEROTTER_EVENT_NAMES.WIN_LOGGED, {
      tag: "craft",
      source: "agent",
    });
  });

  it("counts recent agent wins for the agent quota", async () => {
    const { admin, builders } = mockAdmin([{ count: AGENT_WRITE_QUOTAS.winsPer24h - 1 }, { data: stored }]);
    const result = await createWin(admin, USER_ID, input, { source: "agent" });

    expect(result.ok).toBe(true);
    const quotaQuery = builders[0];
    expect(quotaQuery.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(quotaQuery.eq).toHaveBeenCalledWith("source", "agent");
    expect(quotaQuery.gte).toHaveBeenCalledWith("created_at", expect.any(String));
    expectScopedToUser(builders);
  });

  it("returns quota when the agent is at the limit, without inserting", async () => {
    const { admin, builders } = mockAdmin([{ count: AGENT_WRITE_QUOTAS.winsPer24h }]);
    const result = await createWin(admin, USER_ID, input, { source: "agent" });

    expect(result).toMatchObject({ ok: false, kind: "quota" });
    expect(builders).toHaveLength(1);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("returns db when the quota count fails", async () => {
    const { admin } = mockAdmin([{ error: { code: "08006", message: SECRET_DB_TEXT } }]);
    const result = await createWin(admin, USER_ID, input, { source: "agent" });
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to log win" });
  });

  describe("duplicate external_ref", () => {
    const refInput: WinInput = { ...input, external_ref: "gh:pr:1" };
    const existing = { id: WIN_ID, text: "first write", external_ref: "gh:pr:1" };

    it.each([
      { message: 'duplicate key value violates unique constraint "wins_user_external_ref_key"' },
      { message: "duplicate key", details: "constraint wins_user_external_ref_key" },
    ])("returns the stored row as a duplicate (%p) with no event", async (errorText) => {
      const { admin, builders } = mockAdmin([
        { count: 0 },
        { error: { code: "23505", ...errorText } },
        { data: existing },
      ]);
      const result = await createWin(admin, USER_ID, refInput, { source: "agent" });

      expect(result).toEqual({ ok: true, value: { win: existing, duplicate: true } });
      expect(builders[2].eq).toHaveBeenCalledWith("external_ref", "gh:pr:1");
      expectScopedToUser(builders);
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("treats a unique violation on another constraint as db", async () => {
      const { admin, builders } = mockAdmin([
        { count: 0 },
        { error: { code: "23505", message: 'violates unique constraint "wins_pkey"', details: SECRET_DB_TEXT } },
      ]);
      const result = await createWin(admin, USER_ID, refInput, { source: "agent" });

      expect(result).toEqual({ ok: false, kind: "db", message: "Failed to log win" });
      expect(builders).toHaveLength(2);
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("returns conflict when the existing row vanished", async () => {
      const { admin } = mockAdmin([
        { count: 0 },
        { error: { code: "23505", message: "wins_user_external_ref_key" } },
        { data: null },
      ]);
      const result = await createWin(admin, USER_ID, refInput, { source: "agent" });
      expect(result).toMatchObject({ ok: false, kind: "conflict" });
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("returns db when the lookup of the existing row fails", async () => {
      const { admin } = mockAdmin([
        { count: 0 },
        { error: { code: "23505", message: "wins_user_external_ref_key" } },
        { error: { code: "08006", message: SECRET_DB_TEXT } },
      ]);
      const result = await createWin(admin, USER_ID, refInput, { source: "agent" });
      expect(result).toEqual({ ok: false, kind: "db", message: "Failed to log win" });
    });
  });

  it("never throws, logs, and hides the error text when the client throws", async () => {
    const result = await createWin(throwingAdmin(), USER_ID, input, { source: "manual" });
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to log win" });
    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to log win",
      expect.any(Error),
      expect.objectContaining({ userId: USER_ID, action: "win_log_failed" })
    );
  });
});

describe("listWins", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("REST path: created_at desc only, unbounded, scoped to the user", async () => {
    const { admin, builders } = mockAdmin([{ data: rows }]);
    const result = await listWins(admin, USER_ID, { select: WIN_REST_SELECT, sort: "created_desc" });

    expect(result).toEqual({ ok: true, value: { wins: rows, truncated: false } });
    const [query] = builders;
    expect(query.select).toHaveBeenCalledWith(WIN_REST_SELECT);
    expect(query.order.mock.calls).toEqual([["created_at", { ascending: false }]]);
    expect(query.limit).not.toHaveBeenCalled();
    expectScopedToUser(builders);
  });

  it("applies occurred_at range, tag and limit+1 ordering by occurred_at then created_at", async () => {
    const { admin, builders } = mockAdmin([{ data: rows }]);
    const result = await listWins(admin, USER_ID, {
      since: "2024-01-01",
      until: "2024-06-30",
      tag: "craft",
      limit: 2,
    });

    const [query] = builders;
    expect(query.gte).toHaveBeenCalledWith("occurred_at", "2024-01-01");
    expect(query.lte).toHaveBeenCalledWith("occurred_at", "2024-06-30");
    expect(query.eq).toHaveBeenCalledWith("tag", "craft");
    expect(query.order.mock.calls).toEqual([
      ["occurred_at", { ascending: false }],
      ["created_at", { ascending: false }],
    ]);
    expect(query.limit).toHaveBeenCalledWith(3);
    expect(result).toEqual({ ok: true, value: { wins: rows.slice(0, 2), truncated: true } });
    expectScopedToUser(builders);
  });

  it("is not truncated when the extra row is absent", async () => {
    const { admin } = mockAdmin([{ data: rows }]);
    const result = await listWins(admin, USER_ID, { limit: 3 });
    expect(result).toEqual({ ok: true, value: { wins: rows, truncated: false } });
  });

  it.each([
    [{ since: "2024-02-30" }, "since must be a date in YYYY-MM-DD format"],
    [{ until: "yesterday" }, "until must be a date in YYYY-MM-DD format"],
    [{ tag: "wizardry" }, "Invalid tag"],
    [{ limit: 0 }, "limit must be an integer between 1 and 200"],
    [{ limit: 1.5 }, "limit must be an integer between 1 and 200"],
  ])("rejects %p without querying", async (options, message) => {
    const { admin, from } = mockAdmin([]);
    const result = await listWins(admin, USER_ID, options);
    expect(result).toEqual({ ok: false, kind: "validation", message });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns db with the generic message on a query error", async () => {
    const { admin } = mockAdmin([{ error: { code: "08006", message: SECRET_DB_TEXT } }]);
    const result = await listWins(admin, USER_ID);
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to load wins" });
  });

  it("never throws when the client throws", async () => {
    const result = await listWins(throwingAdmin(), USER_ID);
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to load wins" });
  });
});

describe("updateWin", () => {
  const edited = { id: WIN_ID, text: "edited" };

  it("returns not_found for a non-uuid id without querying", async () => {
    const { admin, from } = mockAdmin([]);
    const result = await updateWin(admin, USER_ID, "w1", { text: "edited" });
    expect(result).toEqual({ ok: false, kind: "not_found", message: "Win not found" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updates with edited_at, scoped to the user", async () => {
    const { admin, builders } = mockAdmin([{ data: edited }]);
    const result = await updateWin(admin, USER_ID, WIN_ID, { text: " edited " });

    expect(result).toEqual({ ok: true, value: edited });
    const [query] = builders;
    expect(query.update).toHaveBeenCalledWith({ text: "edited", edited_at: expect.any(String) });
    expect(query.eq).toHaveBeenCalledWith("id", WIN_ID);
    expect(query.eq).not.toHaveBeenCalledWith("source", expect.anything());
    expect(query.select).toHaveBeenCalledWith(WIN_REST_SELECT);
    expectScopedToUser(builders);
  });

  it("filters by source when onlySource is given and accepts agent fields", async () => {
    const { admin, builders } = mockAdmin([{ data: edited }]);
    await updateWin(admin, USER_ID, WIN_ID, { occurred_at: "2024-03-01" }, {
      onlySource: "agent",
      select: WIN_AGENT_SELECT,
      allowAgentFields: true,
    });
    const [query] = builders;
    expect(query.eq).toHaveBeenCalledWith("source", "agent");
    expect(query.update).toHaveBeenCalledWith({ occurred_at: "2024-03-01", edited_at: expect.any(String) });
    expect(query.select).toHaveBeenCalledWith(WIN_AGENT_SELECT);
  });

  it("returns validation for an empty patch without querying", async () => {
    const { admin, from } = mockAdmin([]);
    const result = await updateWin(admin, USER_ID, WIN_ID, {});
    expect(result).toEqual({ ok: false, kind: "validation", message: "No editable fields provided" });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    [{ error: { code: "PGRST116" } }, { ok: false, kind: "not_found", message: "Win not found" }],
    [{ data: null }, { ok: false, kind: "not_found", message: "Win not found" }],
    [
      { error: { code: "08006", message: SECRET_DB_TEXT } },
      { ok: false, kind: "db", message: "Failed to update win" },
    ],
  ])("maps %p", async (queryResult, expected) => {
    const { admin } = mockAdmin([queryResult]);
    expect(await updateWin(admin, USER_ID, WIN_ID, { text: "edited" })).toEqual(expected);
  });

  it("never throws when the client throws", async () => {
    const result = await updateWin(throwingAdmin(), USER_ID, WIN_ID, { text: "edited" });
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to update win" });
  });
});

describe("deleteWin", () => {
  it("returns not_found for a non-uuid id without querying", async () => {
    const { admin, from } = mockAdmin([]);
    expect(await deleteWin(admin, USER_ID, "w1")).toMatchObject({ ok: false, kind: "not_found" });
    expect(from).not.toHaveBeenCalled();
  });

  it("deletes the user's row", async () => {
    const { admin, builders } = mockAdmin([{ data: { id: WIN_ID } }]);
    const result = await deleteWin(admin, USER_ID, WIN_ID);
    expect(result).toEqual({ ok: true, value: { id: WIN_ID } });
    expect(builders[0].delete).toHaveBeenCalled();
    expect(builders[0].eq).toHaveBeenCalledWith("id", WIN_ID);
    expect(builders[0].eq).not.toHaveBeenCalledWith("source", expect.anything());
    expectScopedToUser(builders);
  });

  it("filters by source when onlySource is given", async () => {
    const { admin, builders } = mockAdmin([{ data: null }]);
    const result = await deleteWin(admin, USER_ID, WIN_ID, { onlySource: "agent" });
    expect(builders[0].eq).toHaveBeenCalledWith("source", "agent");
    expect(result).toEqual({ ok: false, kind: "not_found", message: "Win not found" });
  });

  it("returns db on a query error", async () => {
    const { admin } = mockAdmin([{ error: { code: "08006", message: SECRET_DB_TEXT } }]);
    expect(await deleteWin(admin, USER_ID, WIN_ID)).toEqual({
      ok: false,
      kind: "db",
      message: "Failed to delete win",
    });
  });

  it("never throws when the client throws", async () => {
    expect(await deleteWin(throwingAdmin(), USER_ID, WIN_ID)).toEqual({
      ok: false,
      kind: "db",
      message: "Failed to delete win",
    });
  });
});
