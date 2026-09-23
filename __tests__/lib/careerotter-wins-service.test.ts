/**
 * Tests for the wins domain service (lib/careerotter/wins-service.ts):
 * - validation rules for REST fields and agent-only fields
 * - duplicate external_ref handling (constraint-name check, vanished row)
 * - agent quota, onlySource filtering, user_id scoping on every query
 * - never throws, and never leaks database error text
 * - analytics failures never change a committed result
 */

import { after } from "next/server";
import {
  WIN_AGENT_SELECT,
  WIN_REST_SELECT,
  countWinsByTag,
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
  WIN_TAGS,
} from "@/lib/constants/careerotter";
import { AGENT_WRITE_QUOTAS, MCP_LIST_WINS } from "@/lib/constants/agent-access";
import { NO_ROWS_CODE, UNIQUE_VIOLATION_CODE } from "@/lib/constants/postgres";
import {
  expectScopedToUser,
  hasOp,
  mockSupabaseAdmin,
  throwingSupabaseAdmin,
} from "@/__tests__/utils/test-helpers/supabase-query-mock";

jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));
// next/server (after) is mocked globally in jest.setup.js.

const mockCapture = jest.mocked(captureServerEvent);
const mockLogError = jest.mocked(loggerService.error);
const mockLogWarn = jest.mocked(loggerService.warn);
const mockAfter = jest.mocked(after);

const USER_ID = "8d0e7c1a-2b3c-4d5e-8f90-a1b2c3d4e5f6";
const WIN_ID = "3f1c2a4e-8b7d-4c6a-9e2f-1a2b3c4d5e6f";
const SECRET_DB_TEXT = "relation wins leaked internal detail";
const EXTERNAL_REF_MESSAGE = `external_ref must be a string of 1 to ${EXTERNAL_REF_MAX} characters`;
const LIMIT_MESSAGE = `limit must be an integer between 1 and ${MCP_LIST_WINS.maxLimit}`;

function winRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: WIN_ID,
    text: "shipped it",
    impact_number: null,
    tag: null,
    source: "manual",
    created_at: "2026-01-01T00:00:00.000Z",
    edited_at: null,
    ...overrides,
  };
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

  describe("with the clock fixed late on 2026-03-10 UTC", () => {
    beforeEach(() => {
      jest.useFakeTimers().setSystemTime(new Date("2026-03-10T23:30:00.000Z"));
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it("allows occurred_at up to one day ahead of UTC today, not two", () => {
      expect(validateWinInput({ text: "a", occurred_at: "2026-03-11" }, AGENT).ok).toBe(true);
      expect(validationMessage(validateWinInput({ text: "a", occurred_at: "2026-03-12" }, AGENT)))
        .toBe("occurred_at cannot be in the future");
    });
  });

  it("rejects the year 0000", () => {
    expect(validationMessage(validateWinInput({ text: "a", occurred_at: "0000-01-01" }, AGENT)))
      .toBe("occurred_at must be a date in YYYY-MM-DD format");
  });

  it.each(["javascript:alert(1)", "ftp://example.com/x", "data:text/html,hi", "notaurl", 7])(
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

  it.each([
    "https://user:pass@example.com/pr/1",
    "https://user@example.com/pr/1",
    "https://github.com@evil.com/",
  ])("rejects evidence_url %p with credentials", (evidence_url) => {
    expect(validationMessage(validateWinInput({ text: "a", evidence_url }, AGENT)))
      .toBe("evidence_url must not include a username or password");
  });

  it.each([
    "https://example.com/a b",
    "https://example.com/a\nb",
    "https://example.com/a\tb",
    "https://example.com/a\u0000b",
    "https://example.com/a\u0007b",
  ])("rejects evidence_url %p with embedded whitespace or control characters", (evidence_url) => {
    expect(validationMessage(validateWinInput({ text: "a", evidence_url }, AGENT)))
      .toBe("evidence_url must not contain whitespace or control characters");
  });

  it("accepts an uppercase scheme and stores the normalized URL", () => {
    const result = validateWinInput({ text: "a", evidence_url: "HTTPS://Example.COM/PR/1" }, AGENT);
    expect(result.ok && result.value.evidence_url).toBe("https://example.com/PR/1");
  });

  it("enforces external_ref length 1..max code points after trimming", () => {
    for (const external_ref of ["", "   ", "r".repeat(EXTERNAL_REF_MAX + 1), 12]) {
      expect(validationMessage(validateWinInput({ text: "a", external_ref }, AGENT)))
        .toBe(EXTERNAL_REF_MESSAGE);
    }
    expect(validateWinInput({ text: "a", external_ref: "r".repeat(EXTERNAL_REF_MAX) }, AGENT).ok)
      .toBe(true);
    const astral = "\u{1F600}".repeat(EXTERNAL_REF_MAX);
    expect(validateWinInput({ text: "a", external_ref: astral }, AGENT).ok).toBe(true);
  });

  it.each(["gh:pr:\u00001", "gh:pr\n1", "gh:\u0085pr"])(
    "rejects external_ref %p with control characters",
    (external_ref) => {
      expect(validationMessage(validateWinInput({ text: "a", external_ref }, AGENT)))
        .toBe(EXTERNAL_REF_MESSAGE);
    }
  );
});

describe("validateWinInput — characters Postgres text cannot store", () => {
  it("rejects a NUL in text and impact_number", () => {
    expect(validationMessage(validateWinInput({ text: "ship\u0000it" }, REST)))
      .toBe("Win text must not contain null characters");
    expect(validationMessage(validateWinInput({ text: "a", impact_number: "4\u00002%" }, REST)))
      .toBe("impact_number must not contain null characters");
  });

  it("truncates impact_number by code point, never splitting a surrogate pair", () => {
    const max = WIN_LIMITS.impactNumberMax;
    const impact_number = `${"9".repeat(max - 1)}\u{1F600}\u{1F600}`;
    const result = validateWinInput({ text: "a", impact_number }, REST);
    expect(result.ok && result.value.impact_number).toBe(`${"9".repeat(max - 1)}\u{1F600}`);
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
  const stored = winRow();
  const refInput: WinInput = { ...input, external_ref: "gh:pr:1" };
  const existing = winRow({ text: "first write", source: "agent", external_ref: "gh:pr:1" });

  it("inserts a manual win with no quota query and fires win_logged", async () => {
    const { client: admin, queries } = mockSupabaseAdmin([{ data: stored }]);
    const result = await createWin(admin, USER_ID, input, { source: "manual" });

    expect(result).toEqual({ ok: true, value: { win: stored, duplicate: false } });
    expect(queries).toHaveLength(1);
    expect(queries[0].builder.insert).toHaveBeenCalledWith({ user_id: USER_ID, ...input, source: "manual" });
    expect(queries[0].builder.select).toHaveBeenCalledWith(WIN_REST_SELECT);
    expect(mockCapture).toHaveBeenCalledWith(USER_ID, CAREEROTTER_EVENT_NAMES.WIN_LOGGED, {
      tag: "untagged",
      source: "manual",
    });
  });

  it("uses the given distinct id and select list", async () => {
    const { client: admin, queries } = mockSupabaseAdmin([{ count: 0 }, { data: stored }]);
    await createWin(admin, USER_ID, { ...input, tag: "craft" }, {
      source: "agent",
      select: WIN_AGENT_SELECT,
      distinctId: "distinct-1",
    });
    expect(queries[1].builder.select).toHaveBeenCalledWith(WIN_AGENT_SELECT);
    expect(mockCapture).toHaveBeenCalledWith("distinct-1", CAREEROTTER_EVENT_NAMES.WIN_LOGGED, {
      tag: "craft",
      source: "agent",
    });
  });

  it("counts recent agent wins for the agent quota", async () => {
    const { client: admin, queries } = mockSupabaseAdmin([{ count: AGENT_WRITE_QUOTAS.winsPer24h - 1 }, { data: stored }]);
    const result = await createWin(admin, USER_ID, input, { source: "agent" });

    expect(result.ok).toBe(true);
    const quotaQuery = queries[0].builder;
    expect(quotaQuery.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(quotaQuery.eq).toHaveBeenCalledWith("source", "agent");
    expect(quotaQuery.gte).toHaveBeenCalledWith("created_at", expect.any(String));
    expectScopedToUser(queries, USER_ID);
  });

  it("returns quota when the agent is at the limit, without inserting", async () => {
    const { client: admin, queries } = mockSupabaseAdmin([{ count: AGENT_WRITE_QUOTAS.winsPer24h }]);
    const result = await createWin(admin, USER_ID, input, { source: "agent" });

    expect(result).toMatchObject({ ok: false, kind: "quota" });
    expect(queries).toHaveLength(1);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("returns db when the inserted row is malformed", async () => {
    const { client: admin } = mockSupabaseAdmin([{ data: { id: WIN_ID } }]);
    const result = await createWin(admin, USER_ID, input, { source: "manual" });
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to log win" });
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("keeps the committed result when scheduling analytics throws", async () => {
    mockAfter.mockImplementationOnce(() => {
      throw new Error("after() called outside a request scope");
    });
    const { client: admin } = mockSupabaseAdmin([{ data: stored }]);
    const result = await createWin(admin, USER_ID, input, { source: "manual" });

    expect(result).toEqual({ ok: true, value: { win: stored, duplicate: false } });
    expect(mockLogWarn).toHaveBeenCalledWith(
      "Failed to schedule analytics event",
      expect.objectContaining({ userId: USER_ID })
    );
  });

  it("returns db when the quota count fails", async () => {
    const { client: admin } = mockSupabaseAdmin([{ error: { code: "08006", message: SECRET_DB_TEXT } }]);
    const result = await createWin(admin, USER_ID, input, { source: "agent" });
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to log win" });
  });

  describe("retried external_ref", () => {
    it("returns the stored row before the quota check, even when over quota", async () => {
      const { client: admin, queries } = mockSupabaseAdmin([{ data: existing }]);
      const result = await createWin(admin, USER_ID, refInput, { source: "agent" });

      expect(result).toEqual({ ok: true, value: { win: existing, duplicate: true } });
      expect(queries).toHaveLength(1);
      expect(queries[0].builder.eq).toHaveBeenCalledWith("external_ref", "gh:pr:1");
      expect(queries[0].builder.insert).not.toHaveBeenCalled();
      expectScopedToUser(queries, USER_ID);
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("returns quota for a new ref when over quota", async () => {
      const { client: admin, queries } = mockSupabaseAdmin([
        { data: null },
        { count: AGENT_WRITE_QUOTAS.winsPer24h },
      ]);
      const result = await createWin(admin, USER_ID, refInput, { source: "agent" });
      expect(result).toMatchObject({ ok: false, kind: "quota" });
      expect(queries).toHaveLength(2);
    });

    it("returns db when the prior-write lookup fails", async () => {
      const { client: admin, queries } = mockSupabaseAdmin([
        { error: { code: "08006", message: SECRET_DB_TEXT } },
      ]);
      const result = await createWin(admin, USER_ID, refInput, { source: "agent" });
      expect(result).toEqual({ ok: false, kind: "db", message: "Failed to log win" });
      expect(queries).toHaveLength(1);
    });
  });

  // The prior-write lookup finds nothing, then the insert races another write.
  describe("duplicate external_ref at insert", () => {
    it.each([
      { message: 'duplicate key value violates unique constraint "wins_user_external_ref_key"' },
      { message: "duplicate key", details: "constraint wins_user_external_ref_key" },
    ])("returns the stored row as a duplicate (%p) with no event", async (errorText) => {
      const { client: admin, queries } = mockSupabaseAdmin([
        { data: null },
        { count: 0 },
        { error: { code: UNIQUE_VIOLATION_CODE, ...errorText } },
        { data: existing },
      ]);
      const result = await createWin(admin, USER_ID, refInput, { source: "agent" });

      expect(result).toEqual({ ok: true, value: { win: existing, duplicate: true } });
      expect(queries[3].builder.eq).toHaveBeenCalledWith("external_ref", "gh:pr:1");
      expectScopedToUser(queries, USER_ID);
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("treats a unique violation on another constraint as db", async () => {
      const { client: admin, queries } = mockSupabaseAdmin([
        { data: null },
        { count: 0 },
        {
          error: {
            code: UNIQUE_VIOLATION_CODE,
            message: 'violates unique constraint "wins_pkey"',
            details: SECRET_DB_TEXT,
          },
        },
      ]);
      const result = await createWin(admin, USER_ID, refInput, { source: "agent" });

      expect(result).toEqual({ ok: false, kind: "db", message: "Failed to log win" });
      expect(queries).toHaveLength(3);
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("returns conflict when the existing row vanished", async () => {
      const { client: admin } = mockSupabaseAdmin([
        { data: null },
        { count: 0 },
        { error: { code: UNIQUE_VIOLATION_CODE, message: "wins_user_external_ref_key" } },
        { data: null },
      ]);
      const result = await createWin(admin, USER_ID, refInput, { source: "agent" });
      expect(result).toMatchObject({ ok: false, kind: "conflict" });
      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("returns db when the lookup of the existing row fails", async () => {
      const { client: admin } = mockSupabaseAdmin([
        { data: null },
        { count: 0 },
        { error: { code: UNIQUE_VIOLATION_CODE, message: "wins_user_external_ref_key" } },
        { error: { code: "08006", message: SECRET_DB_TEXT } },
      ]);
      const result = await createWin(admin, USER_ID, refInput, { source: "agent" });
      expect(result).toEqual({ ok: false, kind: "db", message: "Failed to log win" });
    });
  });

  it("never throws, logs, and hides the error text when the client throws", async () => {
    const result = await createWin(throwingSupabaseAdmin().client, USER_ID, input, { source: "manual" });
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to log win" });
    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to log win",
      expect.any(Error),
      expect.objectContaining({ userId: USER_ID, action: "win_log_failed" })
    );
  });
});

describe("listWins", () => {
  const rows = ["a", "b", "c"].map((id) => winRow({ id }));

  it("REST path: created_at desc only, unbounded, scoped to the user", async () => {
    const { client: admin, queries } = mockSupabaseAdmin([{ data: rows }]);
    const result = await listWins(admin, USER_ID, { select: WIN_REST_SELECT, sort: "created_desc" });

    expect(result).toEqual({ ok: true, value: { wins: rows, truncated: false } });
    const [{ builder: query }] = queries;
    expect(query.select).toHaveBeenCalledWith(WIN_REST_SELECT);
    expect(query.order.mock.calls).toEqual([["created_at", { ascending: false }]]);
    expect(query.limit).not.toHaveBeenCalled();
    expectScopedToUser(queries, USER_ID);
  });

  it("applies occurred_at range, tag and limit+1 ordering by occurred_at then created_at", async () => {
    const { client: admin, queries } = mockSupabaseAdmin([{ data: rows }]);
    const result = await listWins(admin, USER_ID, {
      since: "2024-01-01",
      until: "2024-06-30",
      tag: "craft",
      limit: 2,
    });

    const [{ builder: query }] = queries;
    expect(query.gte).toHaveBeenCalledWith("occurred_at", "2024-01-01");
    expect(query.lte).toHaveBeenCalledWith("occurred_at", "2024-06-30");
    expect(query.eq).toHaveBeenCalledWith("tag", "craft");
    expect(query.order.mock.calls).toEqual([
      ["occurred_at", { ascending: false }],
      ["created_at", { ascending: false }],
    ]);
    expect(query.limit).toHaveBeenCalledWith(3);
    expect(result).toEqual({ ok: true, value: { wins: rows.slice(0, 2), truncated: true } });
    expectScopedToUser(queries, USER_ID);
  });

  it("is not truncated when the extra row is absent", async () => {
    const { client: admin } = mockSupabaseAdmin([{ data: rows }]);
    const result = await listWins(admin, USER_ID, { limit: 3 });
    expect(result).toEqual({ ok: true, value: { wins: rows, truncated: false } });
  });

  it.each([
    [{ since: "2024-02-30" }, "since must be a date in YYYY-MM-DD format"],
    [{ until: "yesterday" }, "until must be a date in YYYY-MM-DD format"],
    [{ tag: "wizardry" }, "Invalid tag"],
    [{ since: "0000-01-01" }, "since must be a date in YYYY-MM-DD format"],
    [{ since: "2024-06-30", until: "2024-01-01" }, "since must be on or before until"],
    [{ limit: 0 }, LIMIT_MESSAGE],
    [{ limit: 1.5 }, LIMIT_MESSAGE],
    [{ limit: MCP_LIST_WINS.maxLimit + 1 }, LIMIT_MESSAGE],
  ])("rejects %p without querying", async (options, message) => {
    const { client: admin, from } = mockSupabaseAdmin([]);
    const result = await listWins(admin, USER_ID, options);
    expect(result).toEqual({ ok: false, kind: "validation", message });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns db with the generic message on a query error", async () => {
    const { client: admin } = mockSupabaseAdmin([{ error: { code: "08006", message: SECRET_DB_TEXT } }]);
    const result = await listWins(admin, USER_ID);
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to load wins" });
  });

  it("returns db when a returned row is malformed", async () => {
    const { client: admin } = mockSupabaseAdmin([{ data: [winRow(), { id: 5 }] }]);
    const result = await listWins(admin, USER_ID);
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to load wins" });
  });

  it("never throws when the client throws", async () => {
    const result = await listWins(throwingSupabaseAdmin().client, USER_ID);
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to load wins" });
  });
});

describe("countWinsByTag", () => {
  const LOAD_FAILED = { ok: false, kind: "db", message: "Failed to load wins" };

  it("counts every win and each area with head-only exact counts, scoped to the user", async () => {
    const { client: admin, queries } = mockSupabaseAdmin([
      { count: 12 },
      { count: 5 },
      { count: 0 },
      { count: 3 },
      { count: 1 },
    ]);
    const result = await countWinsByTag(admin, USER_ID);

    expect(result).toEqual({
      ok: true,
      value: {
        total: 12,
        byTag: new Map([["delivery", 5], ["leadership", 0], ["collaboration", 3], ["craft", 1]]),
        untagged: 3,
      },
    });
    expect(queries).toHaveLength(1 + WIN_TAGS.length);
    for (const query of queries) {
      expect(query.table).toBe("wins");
      expect(query.builder.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
      expect(query.builder.limit).not.toHaveBeenCalled();
    }
    expect(hasOp(queries[0], "eq", "tag")).toBe(false);
    WIN_TAGS.forEach((tag, index) => expect(hasOp(queries[index + 1], "eq", "tag", tag)).toBe(true));
    expectScopedToUser(queries, USER_ID);
  });

  it("treats a null count as zero", async () => {
    const { client: admin } = mockSupabaseAdmin([]);
    const result = await countWinsByTag(admin, USER_ID);
    expect(result).toMatchObject({ ok: true, value: { total: 0, untagged: 0 } });
  });

  it("returns the generic failure when any count fails", async () => {
    const { client: admin } = mockSupabaseAdmin([
      { count: 4 },
      { count: 1 },
      { error: { code: "08006", message: SECRET_DB_TEXT } },
    ]);
    const result = await countWinsByTag(admin, USER_ID);
    expect(result).toEqual(LOAD_FAILED);
    expect(JSON.stringify(result)).not.toContain(SECRET_DB_TEXT);
  });

  it("never throws when the client throws", async () => {
    expect(await countWinsByTag(throwingSupabaseAdmin().client, USER_ID)).toEqual(LOAD_FAILED);
  });
});

describe("updateWin", () => {
  const edited = winRow({ text: "edited" });

  it("returns not_found for a non-uuid id without querying", async () => {
    const { client: admin, from } = mockSupabaseAdmin([]);
    const result = await updateWin(admin, USER_ID, "w1", { text: "edited" });
    expect(result).toEqual({ ok: false, kind: "not_found", message: "Win not found" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updates with edited_at, scoped to the user", async () => {
    const { client: admin, queries } = mockSupabaseAdmin([{ data: edited }]);
    const result = await updateWin(admin, USER_ID, WIN_ID, { text: " edited " });

    expect(result).toEqual({ ok: true, value: edited });
    const [{ builder: query }] = queries;
    expect(query.update).toHaveBeenCalledWith({ text: "edited", edited_at: expect.any(String) });
    expect(query.eq).toHaveBeenCalledWith("id", WIN_ID);
    expect(query.eq).not.toHaveBeenCalledWith("source", expect.anything());
    expect(query.select).toHaveBeenCalledWith(WIN_REST_SELECT);
    expectScopedToUser(queries, USER_ID);
  });

  it("filters by source when onlySource is given and accepts agent fields", async () => {
    const { client: admin, queries } = mockSupabaseAdmin([{ data: edited }]);
    await updateWin(admin, USER_ID, WIN_ID, { occurred_at: "2024-03-01" }, {
      onlySource: "agent",
      select: WIN_AGENT_SELECT,
      allowAgentFields: true,
    });
    const [{ builder: query }] = queries;
    expect(query.eq).toHaveBeenCalledWith("source", "agent");
    expect(query.update).toHaveBeenCalledWith({ occurred_at: "2024-03-01", edited_at: expect.any(String) });
    expect(query.select).toHaveBeenCalledWith(WIN_AGENT_SELECT);
  });

  it("returns validation for an empty patch without querying", async () => {
    const { client: admin, from } = mockSupabaseAdmin([]);
    const result = await updateWin(admin, USER_ID, WIN_ID, {});
    expect(result).toEqual({ ok: false, kind: "validation", message: "No editable fields provided" });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    [{ error: { code: NO_ROWS_CODE } }, { ok: false, kind: "not_found", message: "Win not found" }],
    [{ data: null }, { ok: false, kind: "not_found", message: "Win not found" }],
    [
      { error: { code: "08006", message: SECRET_DB_TEXT } },
      { ok: false, kind: "db", message: "Failed to update win" },
    ],
  ])("maps %p", async (queryResult, expected) => {
    const { client: admin } = mockSupabaseAdmin([queryResult]);
    expect(await updateWin(admin, USER_ID, WIN_ID, { text: "edited" })).toEqual(expected);
  });

  it("never throws when the client throws", async () => {
    const result = await updateWin(throwingSupabaseAdmin().client, USER_ID, WIN_ID, { text: "edited" });
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to update win" });
  });
});

describe("deleteWin", () => {
  it("returns not_found for a non-uuid id without querying", async () => {
    const { client: admin, from } = mockSupabaseAdmin([]);
    expect(await deleteWin(admin, USER_ID, "w1")).toMatchObject({ ok: false, kind: "not_found" });
    expect(from).not.toHaveBeenCalled();
  });

  it("deletes the user's row", async () => {
    const { client: admin, queries } = mockSupabaseAdmin([{ data: { id: WIN_ID } }]);
    const result = await deleteWin(admin, USER_ID, WIN_ID);
    expect(result).toEqual({ ok: true, value: { id: WIN_ID } });
    expect(queries[0].builder.delete).toHaveBeenCalled();
    expect(queries[0].builder.eq).toHaveBeenCalledWith("id", WIN_ID);
    expect(queries[0].builder.eq).not.toHaveBeenCalledWith("source", expect.anything());
    expectScopedToUser(queries, USER_ID);
  });

  it("filters by source when onlySource is given", async () => {
    const { client: admin, queries } = mockSupabaseAdmin([{ data: null }]);
    const result = await deleteWin(admin, USER_ID, WIN_ID, { onlySource: "agent" });
    expect(queries[0].builder.eq).toHaveBeenCalledWith("source", "agent");
    expect(result).toEqual({ ok: false, kind: "not_found", message: "Win not found" });
  });

  it("returns db on a query error", async () => {
    const { client: admin } = mockSupabaseAdmin([{ error: { code: "08006", message: SECRET_DB_TEXT } }]);
    expect(await deleteWin(admin, USER_ID, WIN_ID)).toEqual({
      ok: false,
      kind: "db",
      message: "Failed to delete win",
    });
  });

  it("never throws when the client throws", async () => {
    expect(await deleteWin(throwingSupabaseAdmin().client, USER_ID, WIN_ID)).toEqual({
      ok: false,
      kind: "db",
      message: "Failed to delete win",
    });
  });
});
