// @jest-environment node
/**
 * Comp domain service: validation (moved from the REST POST plus the ticker
 * charset and amount caps), create with duplicate external_ref handling and
 * quotas, update with merged-row validation, delete, list, and the pure
 * current/upcoming entry picker. Every query must be scoped to the user.
 */

import {
  COMP_LIMITS,
  createCompEntry,
  currentCompEntry,
  deleteCompEntry,
  listCompEntries,
  updateCompEntry,
  validateCompInput,
} from "@/lib/careerotter/comp-service";
import { AGENT_WRITE_QUOTAS } from "@/lib/constants/agent-access";
import { EXTERNAL_REF_MAX } from "@/lib/constants/careerotter";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { CAREEROTTER_EVENT_NAMES } from "@/lib/analytics/careerotter-event-names";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

jest.mock("@/lib/analytics/posthog-server", () => ({
  captureServerEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockCapture = captureServerEvent as jest.Mock;
const mockLogError = loggerService.error as jest.Mock;

const USER_ID = "user-1";
const ENTRY_ID = "11111111-2222-4333-8444-555555555555";

interface QueryResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}
type Op = [method: string, args: unknown[]];
interface RecordedQuery {
  table: string;
  ops: Op[];
}

const BUILDER_METHODS = [
  "select", "insert", "update", "delete", "eq", "gte", "in",
  "order", "limit", "single", "maybeSingle",
];

/** Fake admin client: each `from()` takes the next queued result and records its chain. */
function fakeAdmin(results: QueryResult[]) {
  const queries: RecordedQuery[] = [];
  const queue = [...results];
  const from = jest.fn((table: string) => {
    const query: RecordedQuery = { table, ops: [] };
    queries.push(query);
    const result = { data: null, error: null, count: null, ...queue.shift() };
    const builder: Record<string, unknown> = {};
    for (const method of BUILDER_METHODS) {
      builder[method] = (...args: unknown[]) => {
        query.ops.push([method, args]);
        return builder;
      };
    }
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return builder;
  });
  return { client: { from } as never, queries, from };
}

function throwingAdmin() {
  const from = jest.fn(() => {
    throw new Error("network down");
  });
  return { client: { from } as never };
}

function hasOp(query: RecordedQuery, method: string, ...args: unknown[]): boolean {
  return query.ops.some(
    ([m, a]) => m === method && args.every((arg, i) => Object.is(a[i], arg))
  );
}

function opArgs(query: RecordedQuery, method: string): unknown[] | undefined {
  return query.ops.find(([m]) => m === method)?.[1];
}

function expectScopedToUser(queries: RecordedQuery[]): void {
  for (const query of queries) expect(hasOp(query, "eq", "user_id", USER_ID)).toBe(true);
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
  it.each(["jan", "2026-02-29", "2026-1-1", undefined, 20260101])(
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

  it("normalizes the ticker: trimmed, uppercased, capped", () => {
    expect(validValue({ ...VALID, ticker: "  brk.b " }).ticker).toBe("BRK.B");
    expect(validValue({ ...VALID, ticker: "abcdefghijkl" }).ticker).toBe("ABCDEFGHIJ");
    expect(validValue({ ...VALID, ticker: "  " }).ticker).toBeNull();
    expect(validValue({ ...VALID, ticker: 5 }).ticker).toBeNull();
  });

  it.each(["AB$C", ".AB", "-X", "A B", "NET<"])("rejects ticker %p", (ticker) => {
    expectInvalid({ ...VALID, ticker }, "ticker must be 1-10 letters, digits, dots or hyphens");
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

  it.each([0, 11, "4", Number.NaN])("rejects vest_years %p", (vest_years) => {
    expectInvalid({ ...VALID, vest_years }, "vest_years must be a number between 0 and 10");
  });

  it.each([1.5, -1, 61, "12"])("rejects vest_cliff_months %p", (vest_cliff_months) => {
    expectInvalid(
      { ...VALID, vest_years: 4, vest_cliff_months },
      "vest_cliff_months must be a whole number between 0 and 60"
    );
  });

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

  it.each(["", "   ", "x".repeat(EXTERNAL_REF_MAX + 1), 42])(
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
    const { client, from } = fakeAdmin([]);
    const result = await createCompEntry(client, USER_ID, { base: 1 }, { source: "manual" });
    expect(result).toMatchObject({ ok: false, kind: "validation" });
    expect(from).not.toHaveBeenCalled();
  });

  it("inserts a manual entry after the total cap check and sends the total", async () => {
    const { client, queries } = fakeAdmin([
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
    const { client, queries } = fakeAdmin([{ count: 0 }, { count: 0 }, { data: row() }]);
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
    const { client, queries } = fakeAdmin([{ count: AGENT_WRITE_QUOTAS.compEntriesPer24h }]);
    const result = await createCompEntry(client, USER_ID, VALID, { source: "agent" });
    expect(result).toMatchObject({ ok: false, kind: "quota" });
    expect(queries.some((q) => opArgs(q, "insert"))).toBe(false);
  });

  it("refuses any write over the total cap", async () => {
    const { client, queries } = fakeAdmin([{ count: AGENT_WRITE_QUOTAS.compEntriesTotal }]);
    const result = await createCompEntry(client, USER_ID, VALID, { source: "manual" });
    expect(result).toMatchObject({ ok: false, kind: "quota" });
    expect(queries).toHaveLength(1);
  });

  it("returns the stored row for a retried ref even when over quota", async () => {
    const { client, queries } = fakeAdmin([
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
    const { client, queries } = fakeAdmin([
      { count: 0 },
      { count: 0 },
      {
        error: {
          code: "23505",
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
    const { client } = fakeAdmin([
      { count: 0 },
      { count: 0 },
      { error: { code: "23505", message: 'violates unique constraint "comp_entries_pkey"', details: "" } },
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
    const { client } = fakeAdmin([
      { count: 0 },
      { count: 0 },
      { error: { code: "23505", message: "comp_entries_user_external_ref_key", details: "" } },
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

  it("maps a count error to db", async () => {
    const { client } = fakeAdmin([{ error: { message: "boom" } }]);
    const result = await createCompEntry(client, USER_ID, VALID, { source: "manual" });
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to save comp entry" });
  });

  it("never throws when the client throws", async () => {
    const result = await createCompEntry(throwingAdmin().client, USER_ID, VALID, {
      source: "manual",
    });
    expect(result).toEqual({ ok: false, kind: "db", message: "Failed to save comp entry" });
  });
});

describe("updateCompEntry", () => {
  it("returns not_found for a non-uuid id without querying", async () => {
    const { client, from } = fakeAdmin([]);
    const result = await updateCompEntry(client, USER_ID, "abc", { base: 1 });
    expect(result).toMatchObject({ ok: false, kind: "not_found" });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([{ external_ref: "x" }, { source: "manual" }])("rejects changing %p", async (patch) => {
    const { client, from } = fakeAdmin([]);
    const result = await updateCompEntry(client, USER_ID, ENTRY_ID, patch);
    expect(result).toEqual({
      ok: false,
      kind: "validation",
      message: "external_ref and source cannot be changed",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns not_found when the row is absent or outside onlySource", async () => {
    const { client, queries } = fakeAdmin([{ data: null }]);
    const result = await updateCompEntry(client, USER_ID, ENTRY_ID, { base: 1 }, { onlySource: "agent" });
    expect(result).toMatchObject({ ok: false, kind: "not_found" });
    expect(hasOp(queries[0], "eq", "source", "agent")).toBe(true);
    expectScopedToUser(queries);
  });

  it("keeps undefined fields, clears null ones and sets updated_at", async () => {
    const existing = row({ note: "old", ticker: "NET", shares: 10 });
    const { client, queries } = fakeAdmin([
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

  it("validates the merged row: clearing vest_years under a cliff fails", async () => {
    const { client, queries } = fakeAdmin([
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
    const { client } = fakeAdmin([{ data: row({ vest_years: 1 }) }]);
    const result = await updateCompEntry(client, USER_ID, ENTRY_ID, { vest_cliff_months: 13 });
    expect(result).toMatchObject({
      ok: false,
      message: "vest_cliff_months cannot exceed the vesting duration",
    });
  });

  it("rejects clearing base", async () => {
    const { client } = fakeAdmin([{ data: row() }]);
    const result = await updateCompEntry(client, USER_ID, ENTRY_ID, { base: null });
    expect(result).toMatchObject({ ok: false, message: "base must be a non-negative number" });
  });

  it("returns not_found when the row disappears before the write", async () => {
    const { client } = fakeAdmin([{ data: row() }, { data: null }]);
    const result = await updateCompEntry(client, USER_ID, ENTRY_ID, { base: 1 });
    expect(result).toMatchObject({ ok: false, kind: "not_found" });
  });

  it("maps a load error to db and never throws", async () => {
    const { client } = fakeAdmin([{ error: { message: "secret db text" } }]);
    expect(await updateCompEntry(client, USER_ID, ENTRY_ID, { base: 1 })).toEqual({
      ok: false,
      kind: "db",
      message: "Failed to update comp entry",
    });
    expect(await updateCompEntry(throwingAdmin().client, USER_ID, ENTRY_ID, { base: 1 })).toEqual({
      ok: false,
      kind: "db",
      message: "Failed to update comp entry",
    });
  });
});

describe("deleteCompEntry", () => {
  it("returns not_found for a non-uuid id without querying", async () => {
    const { client, from } = fakeAdmin([]);
    expect(await deleteCompEntry(client, USER_ID, "not-a-uuid")).toMatchObject({
      ok: false,
      kind: "not_found",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("deletes the user's row", async () => {
    const { client, queries } = fakeAdmin([{ data: { id: ENTRY_ID } }]);
    expect(await deleteCompEntry(client, USER_ID, ENTRY_ID)).toEqual({
      ok: true,
      value: { id: ENTRY_ID },
    });
    expect(hasOp(queries[0], "eq", "id", ENTRY_ID)).toBe(true);
    expect(hasOp(queries[0], "eq", "source", "agent")).toBe(false);
    expectScopedToUser(queries);
  });

  it("filters by onlySource and reports a miss as not_found", async () => {
    const { client, queries } = fakeAdmin([{ data: null }]);
    const result = await deleteCompEntry(client, USER_ID, ENTRY_ID, { onlySource: "agent" });
    expect(result).toMatchObject({ ok: false, kind: "not_found" });
    expect(hasOp(queries[0], "eq", "source", "agent")).toBe(true);
    expectScopedToUser(queries);
  });

  it("maps errors to db and never throws", async () => {
    const { client } = fakeAdmin([{ error: { message: "boom" } }]);
    expect(await deleteCompEntry(client, USER_ID, ENTRY_ID)).toEqual({
      ok: false,
      kind: "db",
      message: "Failed to delete comp entry",
    });
    expect(await deleteCompEntry(throwingAdmin().client, USER_ID, ENTRY_ID)).toMatchObject({
      ok: false,
      kind: "db",
    });
  });
});

describe("listCompEntries", () => {
  it("orders by effective_date then created_at, scoped to the user", async () => {
    const { client, queries } = fakeAdmin([{ data: [row({ base: "150000.00", shares: "12.5" })] }]);
    const result = await listCompEntries(client, USER_ID);
    expect(result).toMatchObject({ ok: true, value: [{ base: 150000, shares: 12.5 }] });
    const orders = queries[0].ops.filter(([m]) => m === "order").map(([, a]) => a[0]);
    expect(orders).toEqual(["effective_date", "created_at"]);
    expect(String(opArgs(queries[0], "select")?.[0])).toContain("external_ref");
    expectScopedToUser(queries);
  });

  it("maps a query error or a malformed row to db", async () => {
    const failing = fakeAdmin([{ error: { message: "boom" } }]);
    expect(await listCompEntries(failing.client, USER_ID)).toEqual({
      ok: false,
      kind: "db",
      message: "Failed to load comp entries",
    });
    const malformed = fakeAdmin([{ data: [{ id: 5 }] }]);
    expect(await listCompEntries(malformed.client, USER_ID)).toMatchObject({ ok: false, kind: "db" });
  });

  it("never throws when the client throws", async () => {
    expect(await listCompEntries(throwingAdmin().client, USER_ID)).toMatchObject({
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
  const AS_OF = new Date("2026-06-15T12:00:00Z");

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

  it("breaks effective_date ties by the latest created_at", () => {
    const entries = [
      entry("second", "2026-03-01", "2026-03-02T00:00:00Z"),
      entry("first", "2026-03-01", "2026-03-01T00:00:00Z"),
    ];
    expect(currentCompEntry(entries, AS_OF).current?.id).toBe("second");
  });

  it("compares dates in UTC", () => {
    const lateEvening = new Date("2026-06-14T23:30:00-05:00");
    expect(currentCompEntry([entry("today", "2026-06-15")], lateEvening).current?.id).toBe("today");
  });

  it("has no current entry when all are future-dated", () => {
    const { current, upcoming } = currentCompEntry([entry("offer", "2026-09-01")], AS_OF);
    expect(current).toBeNull();
    expect(upcoming?.id).toBe("offer");
  });
});
