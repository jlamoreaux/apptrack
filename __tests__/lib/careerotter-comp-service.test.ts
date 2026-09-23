// @jest-environment node
/**
 * Comp domain service: create-time validation and normalization, create with
 * duplicate external_ref handling and quotas, strict patch validation with a
 * merged-row vest check and optimistic concurrency, delete, list, and the pure
 * current/upcoming entry picker. Every query must be scoped to the user, and
 * analytics failures never change a committed result.
 */

import { after } from "next/server";
import {
  createCompEntry,
  currentCompEntry,
  deleteCompEntry,
  listCompEntries,
  updateCompEntry,
  validateCompInput,
} from "@/lib/careerotter/comp-service";
import { AGENT_WRITE_QUOTAS } from "@/lib/constants/agent-access";
import { COMP_LIMITS, EXTERNAL_REF_MAX } from "@/lib/constants/careerotter";
import { UNIQUE_VIOLATION_CODE } from "@/lib/constants/postgres";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import {
  hasOp,
  mockSupabaseAdmin,
  opArgs,
  throwingSupabaseAdmin,
  expectScopedToUser as expectScopedTo,
  type RecordedQuery,
} from "@/__tests__/utils/test-helpers/supabase-query-mock";

jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockCapture = jest.mocked(captureServerEvent);
const mockLogError = jest.mocked(loggerService.error);
const mockLogWarn = jest.mocked(loggerService.warn);
const mockAfter = jest.mocked(after);

const USER_ID = "user-1";
const ENTRY_ID = "11111111-2222-4333-8444-555555555555";
const TICKER_MESSAGE = `ticker must be 1-${COMP_LIMITS.tickerMax} letters, digits, dots or hyphens`;
const VEST_YEARS_MESSAGE = `vest_years must be at least ${COMP_LIMITS.vestYearsMin} and at most ${COMP_LIMITS.vestYearsMax}`;

function expectScopedToUser(queries: RecordedQuery[]): void {
  expectScopedTo(queries, USER_ID);
}

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: ENTRY_ID,
    effective_date: "2026-01-01",
    base: 150000,
    bonus: 20000,
    equity: 0,
    currency: "USD",
    note: null,
    ticker: null,
    shares: null,
    vest_start: null,
    vest_years: null,
    vest_cliff_months: null,
    source: "agent",
    external_ref: null,
    updated_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const VALID = { effective_date: "2026-01-01", base: 150000 };

function expectInvalid(input: Record<string, unknown>, message: string): void {
  expect(validateCompInput(input)).toEqual({ ok: false, kind: "validation", message });
}

function validValue(input: Record<string, unknown>) {
  const result = validateCompInput(input);
  if (!result.ok) throw new Error(`expected valid input, got ${result.message}`);
  return result.value;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("validateCompInput", () => {
  it.each(["jan", "2026-02-29", "2026-1-1", "0000-01-01", undefined, 20260101])(
    "rejects effective_date %p",
    (effective_date) => {
      expectInvalid({ ...VALID, effective_date }, "effective_date must be a valid YYYY-MM-DD date");
    }
  );

  it.each([undefined, -5, "150000", Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects base %p",
    (base) => {
      expectInvalid({ ...VALID, base }, "base must be a non-negative number");
    }
  );

  it("rejects amounts above numeric(12,2)", () => {
    const tooLarge = COMP_LIMITS.amountMax + 1;
    expectInvalid({ ...VALID, base: tooLarge }, "base must be no larger than 9,999,999,999.99");
    expectInvalid({ ...VALID, bonus: tooLarge }, "bonus must be no larger than 9,999,999,999.99");
    expectInvalid({ ...VALID, equity: tooLarge }, "equity must be no larger than 9,999,999,999.99");
  });

  it("accepts amounts at the column maximum", () => {
    const max = COMP_LIMITS.amountMax;
    expect(validValue({ ...VALID, base: max, bonus: max, equity: max })).toMatchObject({
      base: max,
      bonus: max,
      equity: max,
    });
  });

  it("stores an invalid bonus or equity as 0", () => {
    expect(validValue({ ...VALID, bonus: -1, equity: "abc" })).toMatchObject({
      bonus: 0,
      equity: 0,
    });
  });

  it("trims and caps the note, and treats blank as null", () => {
    const long = `  ${"n".repeat(COMP_LIMITS.noteMax + 20)}  `;
    expect(validValue({ ...VALID, note: long }).note).toHaveLength(COMP_LIMITS.noteMax);
    expect(validValue({ ...VALID, note: "   " }).note).toBeNull();
    expect(validValue({ ...VALID, note: 42 }).note).toBeNull();
  });

  it("caps the note by code point, never splitting a surrogate pair", () => {
    const note = `${"n".repeat(COMP_LIMITS.noteMax - 1)}\u{1F600}\u{1F600}`;
    expect(validValue({ ...VALID, note }).note).toBe(`${"n".repeat(COMP_LIMITS.noteMax - 1)}\u{1F600}`);
  });

  it("rejects a note containing a NUL", () => {
    expectInvalid({ ...VALID, note: "a\u0000b" }, "note must not contain null characters");
  });

  it("normalizes the ticker: trimmed and uppercased", () => {
    expect(validValue({ ...VALID, ticker: "  brk.b " }).ticker).toBe("BRK.B");
    expect(validValue({ ...VALID, ticker: "  " }).ticker).toBeNull();
    expect(validValue({ ...VALID, ticker: 5 }).ticker).toBeNull();
  });

  it("rejects a ticker longer than the cap instead of truncating it", () => {
    const atCap = "A".repeat(COMP_LIMITS.tickerMax);
    expect(validValue({ ...VALID, ticker: ` ${atCap} ` }).ticker).toBe(atCap);
    expectInvalid({ ...VALID, ticker: `${atCap}B` }, TICKER_MESSAGE);
  });

  it.each(["AB$C", ".AB", "-X", "A B", "NET<", "NE\u0000T"])("rejects ticker %p", (ticker) => {
    expectInvalid({ ...VALID, ticker }, TICKER_MESSAGE);
  });

  it.each([-1, "10", COMP_LIMITS.sharesMax + 1, Number.NaN])("rejects shares %p", (shares) => {
    expectInvalid(
      { ...VALID, shares },
      "shares must be a non-negative number no larger than 9,999,999,999.9999"
    );
  });

  it("accepts null shares and a valid share count", () => {
    expect(validValue({ ...VALID, shares: null }).shares).toBeNull();
    expect(validValue({ ...VALID, shares: 120.5 }).shares).toBe(120.5);
  });

  it("treats an empty vest_start as absent and rejects a bad one", () => {
    expect(validValue({ ...VALID, vest_start: "" }).vest_start).toBeNull();
    expectInvalid({ ...VALID, vest_start: "2026-13-01" }, "vest_start must be a valid YYYY-MM-DD date");
  });

  it.each([0, 0.005, COMP_LIMITS.vestYearsMax + 1, "4", Number.NaN])(
    "rejects vest_years %p",
    (vest_years) => {
      expectInvalid({ ...VALID, vest_years }, VEST_YEARS_MESSAGE);
    }
  );

  it("states the vest_years bounds in the message", () => {
    expect(VEST_YEARS_MESSAGE).toBe("vest_years must be at least 0.01 and at most 10");
  });

  it("accepts vest_years at both bounds", () => {
    expect(validValue({ ...VALID, vest_years: COMP_LIMITS.vestYearsMin }).vest_years)
      .toBe(COMP_LIMITS.vestYearsMin);
    expect(validValue({ ...VALID, vest_years: COMP_LIMITS.vestYearsMax }).vest_years)
      .toBe(COMP_LIMITS.vestYearsMax);
  });

  it.each([1.5, -1, COMP_LIMITS.vestCliffMonthsMax + 1, "12"])(
    "rejects vest_cliff_months %p",
    (vest_cliff_months) => {
      expectInvalid(
        { ...VALID, vest_years: 4, vest_cliff_months },
        `vest_cliff_months must be a whole number between 0 and ${COMP_LIMITS.vestCliffMonthsMax}`
      );
    }
  );

  it("requires vest_years for a cliff and bounds the cliff by the vest", () => {
    expectInvalid({ ...VALID, vest_cliff_months: 12 }, "vest_cliff_months requires vest_years");
    expectInvalid(
      { ...VALID, vest_years: 1, vest_cliff_months: 13 },
      "vest_cliff_months cannot exceed the vesting duration"
    );
    expect(validValue({ ...VALID, vest_cliff_months: 0 }).vest_cliff_months).toBe(0);
    expect(validValue({ ...VALID, vest_years: 1, vest_cliff_months: 12 }).vest_cliff_months).toBe(12);
  });

  it("trims external_ref and defaults it to null", () => {
    expect(validValue({ ...VALID, external_ref: "  pr-42 " }).external_ref).toBe("pr-42");
    expect(validValue(VALID).external_ref).toBeNull();
  });

  it.each(["", "   ", "x".repeat(EXTERNAL_REF_MAX + 1), 42, "ref\u00001", "ref\t1"])(
    "rejects external_ref %p",
    (external_ref) => {
      expectInvalid(
        { ...VALID, external_ref },
        `external_ref must be a string of 1 to ${EXTERNAL_REF_MAX} characters`
      );
    }
  );
});

describe("createCompEntry", () => {
  it("returns validation errors without touching the database", async () => {
    const { client, from } = mockSupabaseAdmin([]);
    const result = await createCompEntry(client, USER_ID, { base: 1 }, { source: "manual" });
    expect(result).toMatchObject({ ok: false, kind: "validation" });
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts a manual entry after the total cap check and sends the total", async () => {
    const { client, queries } = mockSupabaseAdmin([
      { count: 3 },
      { data: row({ source: "manual" }) },
    ]);
    const result = await createCompEntry(
      client,
      USER_ID,
      { ...VALID, bonus: 20000 },
      { source: "manual" }
    );
    expect(result).toMatchObject({ ok: true, value: { duplicate: false } });
    expect(queries).toHaveLength(2);
    expect(hasOp(queries[0], "eq", "source", "agent")).toBe(false);
    expect(opArgs(queries[1], "insert")?.[0]).toMatchObject({
      user_id: USER_ID,
      source: "manual",
      base: 150000,
      bonus: 20000,
      external_ref: null,
    });
    expect(mockCapture).toHaveBeenCalledWith(USER_ID, CAREEROTTER_EVENT_NAMES.COMP_ENTERED, {
      total: 170000,
    });
    expectScopedToUser(queries.slice(0, 1));
  });

  it("counts recent agent rows for the agent quota and sends no amount", async () => {
    const { client, queries } = mockSupabaseAdmin([{ count: 0 }, { count: 0 }, { data: row() }]);
    const result = await createCompEntry(client, USER_ID, VALID, { source: "agent" });
    expect(result.ok).toBe(true);
    expect(hasOp(queries[0], "eq", "source", "agent")).toBe(true);
    expect(opArgs(queries[0], "gte")?.[0]).toBe("created_at");
    expect(mockCapture).toHaveBeenCalledWith(USER_ID, CAREEROTTER_EVENT_NAMES.COMP_ENTERED, {
      source: "agent",
    });
    expectScopedToUser(queries.slice(0, 2));
  });

  it("refuses an agent write over the 24h quota", async () => {
    const { client, queries } = mockSupabaseAdmin([{ count: AGENT_WRITE_QUOTAS.compEntriesPer24h }]);
    const result = await createCompEntry(client, USER_ID, VALID, { source: "agent" });
    expect(result).toMatchObject({ ok: false, kind: "quota" });
    expect(queries.some((q) => opArgs(q, "insert"))).toBe(false);
  });

  it("refuses any write over the total cap", async () => {
    const { client, queries } = mockSupabaseAdmin([{ count: AGENT_WRITE_QUOTAS.compEntriesTotal }]);
    const result = await createCompEntry(client, USER_ID, VALID, { source: "manual" });
    expect(result).toMatchObject({ ok: false, kind: "quota" });
    expect(queries).toHaveLength(1);
  });

  it("returns the stored row for a retried ref even when over quota", async () => {
    const { client, queries } = mockSupabaseAdmin([
      { count: AGENT_WRITE_QUOTAS.compEntriesPer24h },
      { data: row({ external_ref: "ref-1" }) },
    ]);
    const result = await createCompEntry(
      client,
      USER_ID,
      { ...VALID, external_ref: "ref-1" },
      { source: "agent" }
    );
    expect(result).toMatchObject({ ok: true, value: { duplicate: true } });
    expect(hasOp(queries[1], "eq", "external_ref", "ref-1")).toBe(true);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("returns the existing row on a duplicate external_ref, with no event", async () => {
    const { client, queries } = mockSupabaseAdmin([
      { count: 0 },
      { count: 0 },
      {
        error: {
          code: UNIQUE_VIOLATION_CODE,
          message: 'duplicate key value violates unique constraint "comp_entries_user_external_ref_key"',
          details: "Key (user_id, external_ref)=(...) already exists.",
        },
      },
      { data: row({ external_ref: "ref-1" }) },
    ]);
    const result = await createCompEntry(
      client,
      USER_ID,
      { ...VALID, external_ref: "ref-1" },
      { source: "agent" }
    );
    expect(result).toMatchObject({
      ok: true,
      value: { duplicate: true, entry: { external_ref: "ref-1" } },
    });
    expect(hasOp(queries[3], "eq", "external_ref", "ref-1")).toBe(true);
    expectScopedToUser([queries[0], queries[1], queries[3]]);
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("maps a unique violation on another constraint to a generic db error", async () => {
    const { client } = mockSupabaseAdmin([
      { count: 0 },
      { count: 0 },
      { error: { code: UNIQUE_VIOLATION_CODE, message: 'violates unique constraint "comp_entries_pkey"', details: "" } },
    ]);
    const result = await createCompEntry(
      client,
      USER_ID,
      { ...VALID, external_ref: "ref-1" },
      { source: "agent" }
    );
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to save comp entry" });
    expect(mockLogError).toHaveBeenCalledWith(
      "Failed to add comp entry",
      expect.anything(),
      expect.objectContaining({ category: LogCategory.DATABASE, userId: USER_ID })
    );
  });

  it("returns conflict when the duplicate row vanished before it could be read", async () => {
    const { client } = mockSupabaseAdmin([
      { count: 0 },
      { count: 0 },
      { error: { code: UNIQUE_VIOLATION_CODE, message: "comp_entries_user_external_ref_key", details: "" } },
      { data: null },
    ]);
    const result = await createCompEntry(
      client,
      USER_ID,
      { ...VALID, external_ref: "ref-1" },
      { source: "agent" }
    );
    expect(result).toMatchObject({ ok: false, kind: "conflict" });
  });

  it("keeps the committed result when scheduling analytics throws", async () => {
    mockAfter.mockImplementationOnce(() => {
      throw new Error("after() called outside a request scope");
    });
    const stored = row({ source: "manual" });
    const { client } = mockSupabaseAdmin([{ count: 0 }, { data: stored }]);
    const result = await createCompEntry(client, USER_ID, VALID, { source: "manual" });
    expect(result).toEqual({ ok: true, value: { entry: stored, duplicate: false } });
    expect(mockLogWarn).toHaveBeenCalledWith(
      "Failed to schedule analytics event",
      expect.objectContaining({ userId: USER_ID })
    );
  });

  it("maps a count error to db", async () => {
    const { client } = mockSupabaseAdmin([{ error: { message: "boom" } }]);
    const result = await createCompEntry(client, USER_ID, VALID, { source: "manual" });
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to save comp entry" });
  });

  it("never throws when the client throws", async () => {
    const result = await createCompEntry(throwingSupabaseAdmin().client, USER_ID, VALID, {
      source: "manual",
    });
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to save comp entry" });
  });
});

describe("updateCompEntry", () => {
  it("returns not_found for a non-uuid id without querying", async () => {
    const { client, from } = mockSupabaseAdmin([]);
    const result = await updateCompEntry(client, USER_ID, "abc", { base: 1 });
    expect(result).toMatchObject({ ok: false, kind: "not_found" });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([null, "base=1", 5, [{ base: 1 }]])("rejects a %p patch without querying", async (patch) => {
    const { client, from } = mockSupabaseAdmin([]);
    const result = await updateCompEntry(client, USER_ID, ENTRY_ID, patch);
    expect(result).toEqual({
      ok: false,
      kind: "validation",
      message: "Comp entry changes must be a JSON object",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([{ external_ref: "x" }, { source: "manual" }])("rejects changing %p", async (patch) => {
    const { client, from } = mockSupabaseAdmin([]);
    const result = await updateCompEntry(client, USER_ID, ENTRY_ID, patch);
    expect(result).toEqual({
      ok: false,
      kind: "validation",
      message: "external_ref and source cannot be changed",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    [{ bonus: "5000" }, "bonus must be a non-negative number"],
    [{ bonus: -1 }, "bonus must be a non-negative number"],
    [{ equity: Number.NaN }, "equity must be a non-negative number"],
    [{ ticker: 5 }, TICKER_MESSAGE],
    [{ ticker: "ABCDEFGHIJK" }, TICKER_MESSAGE],
    [{ note: 5 }, "note must be a string"],
    [{ note: "n".repeat(COMP_LIMITS.noteMax + 1) }, `note must be ${COMP_LIMITS.noteMax} characters or fewer`],
    [{ note: "a\u0000b" }, "note must not contain null characters"],
    [{ effective_date: null }, "effective_date must be a valid YYYY-MM-DD date"],
    [{ vest_start: "soon" }, "vest_start must be a valid YYYY-MM-DD date"],
    [{ vest_years: 0.005 }, VEST_YEARS_MESSAGE],
    [{ base: null }, "base must be a non-negative number"],
  ])("rejects the patch %p without querying", async (patch, message) => {
    const { client, from } = mockSupabaseAdmin([]);
    const result = await updateCompEntry(client, USER_ID, ENTRY_ID, patch);
    expect(result).toEqual({ ok: false, kind: "validation", message });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns not_found when the row is absent or outside onlySource", async () => {
    const { client, queries } = mockSupabaseAdmin([{ data: null }]);
    const result = await updateCompEntry(client, USER_ID, ENTRY_ID, { base: 1 }, { onlySource: "agent" });
    expect(result).toMatchObject({ ok: false, kind: "not_found" });
    expect(hasOp(queries[0], "eq", "source", "agent")).toBe(true);
    expectScopedToUser(queries);
  });

  it("keeps undefined fields, clears null ones and sets updated_at", async () => {
    const existing = row({ note: "old", ticker: "NET", shares: 10 });
    const { client, queries } = mockSupabaseAdmin([
      { data: existing },
      { data: row({ base: 200000, note: null, ticker: "NET", shares: 10 }) },
    ]);
    const result = await updateCompEntry(
      client,
      USER_ID,
      ENTRY_ID,
      { base: 200000, note: null, bonus: undefined },
      { onlySource: "agent" }
    );
    expect(result).toMatchObject({ ok: true, value: { base: 200000, note: null } });
    const payload = opArgs(queries[1], "update")?.[0];
    expect(payload).toMatchObject({
      base: 200000,
      bonus: 20000,
      note: null,
      ticker: "NET",
      shares: 10,
      effective_date: "2026-01-01",
    });
    expect(payload).toEqual(expect.objectContaining({ updated_at: expect.any(String) }));
    expect(payload).not.toHaveProperty("external_ref");
    expect(payload).not.toHaveProperty("source");
    expect(hasOp(queries[1], "eq", "id", ENTRY_ID)).toBe(true);
    expect(hasOp(queries[1], "eq", "source", "agent")).toBe(true);
    expectScopedToUser(queries);
  });

  it("clears bonus and equity to 0 and the grant fields to null", async () => {
    const existing = row({ bonus: 5, equity: 7, ticker: "NET", shares: 10, vest_years: 4 });
    const { client, queries } = mockSupabaseAdmin([{ data: existing }, { data: row() }]);
    const result = await updateCompEntry(client, USER_ID, ENTRY_ID, {
      bonus: null,
      equity: null,
      ticker: null,
      shares: null,
      vest_years: null,
    });
    expect(result.ok).toBe(true);
    expect(opArgs(queries[1], "update")?.[0]).toMatchObject({
      bonus: 0,
      equity: 0,
      ticker: null,
      shares: null,
      vest_years: null,
    });
  });

  it("normalizes a valid ticker on update", async () => {
    const { client, queries } = mockSupabaseAdmin([{ data: row() }, { data: row() }]);
    await updateCompEntry(client, USER_ID, ENTRY_ID, { ticker: " net " });
    expect(opArgs(queries[1], "update")?.[0]).toMatchObject({ ticker: "NET" });
  });

  it("conditions the write on a null updated_at with is()", async () => {
    const { client, queries } = mockSupabaseAdmin([{ data: row() }, { data: row() }]);
    await updateCompEntry(client, USER_ID, ENTRY_ID, { base: 1 });
    expect(hasOp(queries[1], "is", "updated_at", null)).toBe(true);
    expect(hasOp(queries[1], "eq", "updated_at")).toBe(false);
  });

  it("conditions the write on the updated_at that was read", async () => {
    const readAt = "2026-02-01T10:00:00.123456+00:00";
    const { client, queries } = mockSupabaseAdmin([
      { data: row({ updated_at: readAt }) },
      { data: row() },
    ]);
    await updateCompEntry(client, USER_ID, ENTRY_ID, { base: 1 });
    expect(hasOp(queries[1], "eq", "updated_at", readAt)).toBe(true);
    expect(hasOp(queries[1], "is", "updated_at")).toBe(false);
  });

  it("returns conflict when the row changed (or vanished) between read and write", async () => {
    const { client } = mockSupabaseAdmin([{ data: row() }, { data: null }]);
    const result = await updateCompEntry(client, USER_ID, ENTRY_ID, { base: 1 });
    expect(result).toEqual({
      ok: false,
      kind: "conflict",
      message: "This comp entry changed while saving; try again",
    });
  });

  it("validates the merged row: clearing vest_years under a cliff fails", async () => {
    const { client, queries } = mockSupabaseAdmin([
      { data: row({ vest_years: 4, vest_cliff_months: 12 }) },
    ]);
    const result = await updateCompEntry(client, USER_ID, ENTRY_ID, { vest_years: null });
    expect(result).toEqual({
      ok: false,
      kind: "validation",
      message: "vest_cliff_months requires vest_years",
    });
    expect(queries).toHaveLength(1);
  });

  it("validates the merged row: a cliff longer than the stored vest fails", async () => {
    const { client } = mockSupabaseAdmin([{ data: row({ vest_years: 1 }) }]);
    const result = await updateCompEntry(client, USER_ID, ENTRY_ID, { vest_cliff_months: 13 });
    expect(result).toMatchObject({
      ok: false,
      message: "vest_cliff_months cannot exceed the vesting duration",
    });
  });

  it("maps a load error to db and never throws", async () => {
    const { client } = mockSupabaseAdmin([{ error: { message: "secret db text" } }]);
    expect(await updateCompEntry(client, USER_ID, ENTRY_ID, { base: 1 })).toEqual({
      ok: false,
      kind: "db",
      message: "Failed to update comp entry",
    });
    expect(await updateCompEntry(throwingSupabaseAdmin().client, USER_ID, ENTRY_ID, { base: 1 })).toEqual({
      ok: false,
      kind: "db",
      message: "Failed to update comp entry",
    });
  });
});

describe("deleteCompEntry", () => {
  it("returns not_found for a non-uuid id without querying", async () => {
    const { client, from } = mockSupabaseAdmin([]);
    expect(await deleteCompEntry(client, USER_ID, "not-a-uuid")).toMatchObject({
      ok: false,
      kind: "not_found",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("deletes the user's row", async () => {
    const { client, queries } = mockSupabaseAdmin([{ data: { id: ENTRY_ID } }]);
    expect(await deleteCompEntry(client, USER_ID, ENTRY_ID)).toEqual({
      ok: true,
      value: { id: ENTRY_ID },
    });
    expect(hasOp(queries[0], "eq", "id", ENTRY_ID)).toBe(true);
    expect(hasOp(queries[0], "eq", "source", "agent")).toBe(false);
    expectScopedToUser(queries);
  });

  it("filters by onlySource and reports a miss as not_found", async () => {
    const { client, queries } = mockSupabaseAdmin([{ data: null }]);
    const result = await deleteCompEntry(client, USER_ID, ENTRY_ID, { onlySource: "agent" });
    expect(result).toMatchObject({ ok: false, kind: "not_found" });
    expect(hasOp(queries[0], "eq", "source", "agent")).toBe(true);
    expectScopedToUser(queries);
  });

  it("maps errors to db and never throws", async () => {
    const { client } = mockSupabaseAdmin([{ error: { message: "boom" } }]);
    expect(await deleteCompEntry(client, USER_ID, ENTRY_ID)).toEqual({
      ok: false,
      kind: "db",
      message: "Failed to delete comp entry",
    });
    expect(await deleteCompEntry(throwingSupabaseAdmin().client, USER_ID, ENTRY_ID)).toMatchObject({
      ok: false,
      kind: "db",
    });
  });
});

describe("listCompEntries", () => {
  it("orders by effective_date then created_at, scoped to the user", async () => {
    const { client, queries } = mockSupabaseAdmin([{ data: [row({ base: "150000.00", shares: "12.5" })] }]);
    const result = await listCompEntries(client, USER_ID);
    expect(result).toMatchObject({ ok: true, value: [{ base: 150000, shares: 12.5 }] });
    const orders = queries[0].ops.filter(([m]) => m === "order").map(([, a]) => a[0]);
    expect(orders).toEqual(["effective_date", "created_at"]);
    expect(String(opArgs(queries[0], "select")?.[0])).toContain("external_ref");
    expectScopedToUser(queries);
  });

  it("maps a query error or a malformed row to db", async () => {
    const failing = mockSupabaseAdmin([{ error: { message: "boom" } }]);
    expect(await listCompEntries(failing.client, USER_ID)).toEqual({
      ok: false,
      kind: "db",
      message: "Failed to load comp entries",
    });
    const malformed = mockSupabaseAdmin([{ data: [{ id: 5 }] }]);
    expect(await listCompEntries(malformed.client, USER_ID)).toMatchObject({ ok: false, kind: "db" });
  });

  it("never throws when the client throws", async () => {
    expect(await listCompEntries(throwingSupabaseAdmin().client, USER_ID)).toMatchObject({
      ok: false,
      kind: "db",
    });
  });
});

describe("currentCompEntry", () => {
  const entry = (id: string, effective_date: string, created_at = "2026-01-01T00:00:00Z") => ({
    id,
    effective_date,
    created_at,
  });
  const AS_OF = "2026-06-15";

  it("returns nulls for no entries", () => {
    expect(currentCompEntry([], AS_OF)).toEqual({ current: null, upcoming: null });
  });

  it("picks the latest entry on or before as_of and the earliest future one", () => {
    const entries = [
      entry("old", "2025-01-01"),
      entry("now", "2026-06-15"),
      entry("far", "2027-01-01"),
      entry("next", "2026-07-01"),
    ];
    const { current, upcoming } = currentCompEntry(entries, AS_OF);
    expect(current?.id).toBe("now");
    expect(upcoming?.id).toBe("next");
  });

  it("breaks effective_date ties by the latest created_at, for current and upcoming", () => {
    const entries = [
      entry("second", "2026-03-01", "2026-03-02T00:00:00Z"),
      entry("first", "2026-03-01", "2026-03-01T00:00:00Z"),
      entry("offer-late", "2026-09-01", "2026-03-05T00:00:00Z"),
      entry("offer-early", "2026-09-01", "2026-03-04T00:00:00Z"),
    ];
    const { current, upcoming } = currentCompEntry(entries, AS_OF);
    expect(current?.id).toBe("second");
    expect(upcoming?.id).toBe("offer-late");
  });

  it("breaks ties on created_at down to the microsecond", () => {
    const entries = [
      entry("later", "2026-03-01", "2026-03-01T10:00:00.123457+00:00"),
      entry("earlier", "2026-03-01", "2026-03-01T10:00:00.123456+00:00"),
    ];
    expect(currentCompEntry(entries, AS_OF).current?.id).toBe("later");
    expect(currentCompEntry([...entries].reverse(), AS_OF).current?.id).toBe("later");
  });

  it.each(["2026-02-30", "June 15", "2026-06-15T12:00:00Z", "0000-01-01", ""])(
    "matches nothing for an invalid as_of %p",
    (asOf) => {
      expect(currentCompEntry([entry("now", "2026-01-01")], asOf)).toEqual({
        current: null,
        upcoming: null,
      });
    }
  );

  it("has no current entry when all are future-dated", () => {
    const { current, upcoming } = currentCompEntry([entry("offer", "2026-09-01")], AS_OF);
    expect(current).toBeNull();
    expect(upcoming?.id).toBe("offer");
  });
});
