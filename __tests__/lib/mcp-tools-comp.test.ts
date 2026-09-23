/**
 * @jest-environment node
 */
/**
 * MCP comp tools, exercised through a real McpServer and SDK client over an
 * in-memory transport. The client lists tools before calling them, so it
 * validates every structuredContent against the tool's advertised output
 * schema (and define-tool re-validates it server side).
 *
 * Services are mocked for wiring; projections use the real comp-projection
 * functions so the tools are checked for parity with the comp page's math.
 */

import { COMP_TOOLS } from "@/lib/mcp/tools/comp";
import {
  annualBreakdown,
  parseLocalDate,
  projectComp,
  vestSummary,
  type CompEntry,
  type ProjectionYear,
  type StockQuote,
} from "@/lib/careerotter/comp-projection";
import {
  createCompEntry,
  deleteCompEntry,
  listCompEntries,
  updateCompEntry,
  type StoredCompEntry,
} from "@/lib/careerotter/comp-service";
import { loadQuotes, readValidCachedQuotes } from "@/lib/careerotter/stock-price-cache";
import { normalizeTicker } from "@/lib/careerotter/tickers";
import { isProUser } from "@/lib/careerotter/plan";
import { compDelta, lookupMarketRange, MARKET_DATA_SOURCE } from "@/lib/careerotter/market-data";
import { MS_PER_DAY } from "@/lib/constants/dates";
import {
  MCP_COMP_MESSAGES,
  MCP_OFFER_CURRENT_LABEL,
  MCP_OFFER_NOT_MODELED,
  MCP_QUOTE_STALE_AFTER_DAYS,
} from "@/lib/constants/mcp-comp";
import {
  INVALID_ARGUMENTS,
  TEST_ADMIN,
  TEST_USER_ID,
  call as callTool,
  errorTextOf,
  listTools,
  recordsField,
  structuredOf,
  textOf,
  toolNames,
  type CallResult,
  type McpHarness,
} from "@/__tests__/utils/test-helpers/mcp-client";
import type { McpMocks } from "@/__tests__/utils/test-helpers/mcp-mocks";
import type { AgentTokenScope, DomainResult } from "@/types";

jest.mock("@/lib/analytics/posthog-server", () =>
  jest.requireActual<McpMocks>("@/__tests__/utils/test-helpers/mcp-mocks").posthogServerMock()
);
jest.mock("@/lib/services/logger.service", () =>
  jest.requireActual<McpMocks>("@/__tests__/utils/test-helpers/mcp-mocks").loggerServiceMock()
);
jest.mock("@/lib/careerotter/comp-service", () => ({
  ...jest.requireActual<object>("@/lib/careerotter/comp-service"),
  listCompEntries: jest.fn(),
  createCompEntry: jest.fn(),
  updateCompEntry: jest.fn(),
  deleteCompEntry: jest.fn(),
}));
jest.mock("@/lib/careerotter/stock-price-cache", () => ({
  ...jest.requireActual<object>("@/lib/careerotter/stock-price-cache"),
  loadQuotes: jest.fn(),
  readValidCachedQuotes: jest.fn(),
}));
jest.mock("@/lib/careerotter/plan", () => ({ isProUser: jest.fn() }));

const mockList = jest.mocked(listCompEntries);
const mockCreate = jest.mocked(createCompEntry);
const mockUpdate = jest.mocked(updateCompEntry);
const mockDelete = jest.mocked(deleteCompEntry);
const mockReadQuotes = jest.mocked(readValidCachedQuotes);
const mockLoadQuotes = jest.mocked(loadQuotes);
const mockIsPro = jest.mocked(isProUser);
const mockFetch = jest.fn();

const NOW = new Date("2026-09-23T12:00:00Z");
// Vesting is measured in local time at UTC's wall clock, so today's local
// date is the UTC date in any server zone.
const NOW_LOCAL = new Date(2026, 8, 23, 12);
const TODAY = "2026-09-23";
const HARNESS: McpHarness = { tools: COMP_TOOLS, scopes: ["comp:write"], now: NOW };
const CURRENT_ID = "11111111-1111-4111-8111-111111111111";
const UPCOMING_ID = "22222222-2222-4222-8222-222222222222";
const FLAT_ID = "33333333-3333-4333-8333-333333333333";
const UNKNOWN_ID = "44444444-4444-4444-8444-444444444444";

const READ_TOOL_NAMES = [
  "evaluate_offer",
  "get_comp_summary",
  "get_equity_quotes",
  "get_market_benchmark",
  "list_comp_entries",
  "project_comp",
];
const WRITE_TOOL_NAMES = ["add_comp_entry", "delete_comp_entry", "update_comp_entry"];

function stored(overrides: Partial<StoredCompEntry>): StoredCompEntry {
  return {
    id: CURRENT_ID,
    effective_date: "2024-01-15",
    base: 150_000,
    bonus: 15_000,
    equity: 200_000,
    currency: "USD",
    note: null,
    ticker: "ACME",
    shares: 1000,
    vest_start: "2024-02-01",
    vest_years: 4,
    vest_cliff_months: 12,
    source: "manual",
    external_ref: null,
    updated_at: null,
    created_at: "2024-01-15T10:00:00.000Z",
    ...overrides,
  };
}

const CURRENT = stored({});
const UPCOMING = stored({
  id: UPCOMING_ID,
  effective_date: "2027-03-01",
  base: 180_000,
  bonus: 0,
  equity: 0,
  ticker: "BETA",
  shares: null,
  vest_start: null,
  vest_years: null,
  vest_cliff_months: null,
  source: "agent",
  external_ref: "offer:beta",
  created_at: "2026-09-01T10:00:00.000Z",
});
const FLAT = stored({
  id: FLAT_ID,
  effective_date: "2023-05-01",
  ticker: null,
  shares: null,
  equity: 40_000,
  vest_start: null,
  vest_years: null,
  vest_cliff_months: null,
  created_at: "2023-05-01T10:00:00.000Z",
});

const ACME_QUOTE: StockQuote = {
  price: 300,
  as_of: "2026-09-23T06:00:00.000Z",
  change: 1.5,
  change_pct: 0.5,
  previous_close: 298.5,
  company_name: "Acme",
  exchange: "NASDAQ",
  market_cap_musd: 1000,
  logo_url: null,
};

function call(
  name: string,
  args: Record<string, unknown> = {},
  scopes?: AgentTokenScope[]
): Promise<CallResult> {
  return callTool(HARNESS, name, args, scopes);
}

async function callOk(name: string, args: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
  return structuredOf(await call(name, args));
}

async function callError(name: string, args: Record<string, unknown> = {}): Promise<string> {
  return errorTextOf(await call(name, args));
}

const FRESH_QUOTE = { price_as_of: ACME_QUOTE.as_of, price_is_stale: false };
const NO_QUOTE = { price_as_of: null, price_is_stale: false };

function rows(years: ProjectionYear[]) {
  return years.map((row) => ({
    year: row.year,
    salary: row.salary,
    incentives: row.incentives,
    stock_vested: row.stockVested,
    stock_unvested: row.stockUnvested,
    stock: row.stock,
    total: row.total,
  }));
}

function projectedTotal(entry: CompEntry, sharePrice: number | null, years: number[], asOf: Date): number {
  return projectComp(entry, { sharePrice, years, asOf }).years.reduce((sum, row) => sum + row.total, 0);
}

function listReturns(entries: StoredCompEntry[]): void {
  mockList.mockResolvedValue({ ok: true, value: entries });
}

function quotesReturn(quotes: Record<string, StockQuote>): void {
  mockReadQuotes.mockImplementation(async (_admin, tickers) => {
    const found: Record<string, StockQuote> = {};
    for (const ticker of tickers.map(normalizeTicker)) if (quotes[ticker]) found[ticker] = quotes[ticker];
    return { ok: true, value: found };
  });
}

const DB_FAILURE: DomainResult<never> = { ok: false, kind: "db", message: "Failed to load comp entries" };

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
  listReturns([FLAT, CURRENT, UPCOMING]);
  quotesReturn({ ACME: ACME_QUOTE });
  mockIsPro.mockResolvedValue({ ok: true, value: true });
});

afterEach(() => {
  expect(mockLoadQuotes).not.toHaveBeenCalled();
  expect(mockFetch).not.toHaveBeenCalled();
});

// ── registration ───────────────────────────────────────────────────────────

describe("scope gating", () => {
  it("gives comp:read only the read tools", async () => {
    expect(await toolNames(HARNESS, ["comp:read"])).toEqual(READ_TOOL_NAMES);
  });

  it("gives comp:write every comp tool", async () => {
    expect(await toolNames(HARNESS, ["comp:write"])).toEqual([...READ_TOOL_NAMES, ...WRITE_TOOL_NAMES].sort());
  });

  it("gives no comp tool to tokens without a comp scope", async () => {
    // With no tool registered the server does not offer tools/list at all.
    await expect(toolNames(HARNESS, ["wins:write", "career:read"])).rejects.toThrow(/Method not found/);
  });

  it("marks reads read-only, updates non-idempotent and delete destructive and idempotent", async () => {
    const tools = await listTools(HARNESS, ["comp:write"]);
    const byName = new Map(tools.map((tool) => [tool.name, tool.annotations]));
    for (const name of READ_TOOL_NAMES) expect(byName.get(name)?.readOnlyHint).toBe(true);
    expect(byName.get("delete_comp_entry")).toMatchObject({ destructiveHint: true, idempotentHint: true });
    expect(byName.get("add_comp_entry")).toMatchObject({ readOnlyHint: false, idempotentHint: false });
    expect(byName.get("update_comp_entry")).toMatchObject({ readOnlyHint: false, idempotentHint: false });
  });

  it("states the currency, equity, UTC and confirmation rules in the descriptions", async () => {
    const tools = await listTools(HARNESS, ["comp:write"]);
    const describe = (name: string): string => tools.find((tool) => tool.name === name)?.description ?? "";
    expect(describe("add_comp_entry")).toMatch(/USD/);
    expect(describe("add_comp_entry")).toMatch(/total grant value/);
    expect(describe("update_comp_entry")).toMatch(/agent created/);
    expect(describe("delete_comp_entry")).toMatch(/agent created/);
    for (const name of ["add_comp_entry", "update_comp_entry"]) expect(describe(name)).toMatch(/confirmed/);
    expect(describe("delete_comp_entry")).toMatch(/Delete only when the user asked/);
    expect(describe("add_comp_entry")).toMatch(/returned unchanged/);
    expect(describe("project_comp")).toMatch(/UTC/);
    expect(describe("project_comp")).toMatch(/price_is_stale/);
    expect(describe("evaluate_offer")).toMatch(/as_of/);
  });
});

// ── list_comp_entries ──────────────────────────────────────────────────────

describe("list_comp_entries", () => {
  it("returns every entry with provenance and timestamps", async () => {
    const result = await call("list_comp_entries");
    expect(mockList).toHaveBeenCalledWith(TEST_ADMIN, TEST_USER_ID);
    expect(structuredOf(result).entries).toEqual([FLAT, CURRENT, UPCOMING]);
    expect(textOf(result)).toBe("Returned 3 comp entries.");
  });

  it("reports a load failure as an error", async () => {
    mockList.mockResolvedValue(DB_FAILURE);
    expect(await callError("list_comp_entries")).toBe("Failed to load comp entries");
  });
});

// ── get_comp_summary ───────────────────────────────────────────────────────

describe("get_comp_summary", () => {
  it("summarizes the current entry at the cached quote, today in UTC", async () => {
    const out = await callOk("get_comp_summary");
    const breakdown = annualBreakdown(CURRENT, 300);
    const vest = vestSummary(CURRENT, 300, NOW_LOCAL);
    expect(out).toEqual({
      as_of: TODAY,
      current: {
        entry: CURRENT,
        share_price: 300,
        price_source: "quote",
        ...FRESH_QUOTE,
        annual: {
          salary: breakdown.salary,
          incentives: breakdown.incentives,
          equity_per_year: breakdown.equityPerYear,
          total: breakdown.total,
        },
        vest: {
          grant_value: vest?.grantValue,
          vested_fraction: vest?.vestedFraction,
          vested_value: vest?.vestedValue,
          unvested_value: vest?.unvestedValue,
          cliff_date: "2025-02-01",
          cliff_passed: true,
          cliff_value: vest?.cliffValue,
          fully_vested_date: "2028-02-01",
          fully_vested: false,
        },
      },
      upcoming: UPCOMING,
    });
    expect(mockReadQuotes).toHaveBeenCalledWith(TEST_ADMIN, ["ACME"]);
  });

  it("flags a quote older than the staleness threshold", async () => {
    const staleAsOf = new Date(NOW.getTime() - (MCP_QUOTE_STALE_AFTER_DAYS + 1) * MS_PER_DAY).toISOString();
    quotesReturn({ ACME: { ...ACME_QUOTE, as_of: staleAsOf } });
    const out = await callOk("get_comp_summary");
    expect(out.current).toMatchObject({ price_source: "quote", price_as_of: staleAsOf, price_is_stale: true });
  });

  it("finds the quote for a ticker stored in another case", async () => {
    listReturns([{ ...CURRENT, ticker: " acme " }]);
    const out = await callOk("get_comp_summary");
    expect(out.current).toMatchObject({ share_price: 300, price_source: "quote", ...FRESH_QUOTE });
  });

  it("falls back to the implied price when no quote is cached", async () => {
    quotesReturn({});
    const out = await callOk("get_comp_summary");
    expect(out.current).toMatchObject({ share_price: 200, price_source: "implied", ...NO_QUOTE });
  });

  it("reports no price for an entry without shares", async () => {
    listReturns([FLAT]);
    const out = await callOk("get_comp_summary");
    expect(out.current).toMatchObject({ share_price: null, price_source: "none", ...NO_QUOTE, vest: null });
  });

  it("returns current: null, not an error, before any entry is in effect", async () => {
    const out = await callOk("get_comp_summary", { as_of: "2022-06-01" });
    expect(out).toEqual({ as_of: "2022-06-01", current: null, upcoming: FLAT });
  });

  it.each(["2026-02-30", "1969-12-31"])("rejects as_of %s", async (asOf) => {
    expect(await callError("get_comp_summary", { as_of: asOf })).toMatch(INVALID_ARGUMENTS);
  });
});

// ── project_comp ───────────────────────────────────────────────────────────

describe("project_comp", () => {
  it("matches projectComp for the current entry at the anchor price over 4 years", async () => {
    const years = [2026, 2027, 2028, 2029];
    const expected = projectComp(CURRENT, { sharePrice: 300, years, asOf: NOW_LOCAL });
    const out = await callOk("project_comp");
    expect(out).toEqual({
      entry_id: CURRENT_ID,
      as_of: TODAY,
      share_price: 300,
      price_source: "quote",
      ...FRESH_QUOTE,
      has_vest_schedule: true,
      grant_value: expected.grantValue,
      rows: rows(expected.years),
      total: projectedTotal(CURRENT, 300, years, NOW_LOCAL),
    });
  });

  it("pins the year list and vesting instant to as_of", async () => {
    const asOf = parseLocalDate("2025-06-30");
    const expected = projectComp(CURRENT, { sharePrice: 250, years: [2025, 2026], asOf });
    const out = await callOk("project_comp", { as_of: "2025-06-30", years: 2, share_price: 250 });
    expect(out).toMatchObject({ as_of: "2025-06-30", share_price: 250, price_source: "given", ...NO_QUOTE });
    expect(out.rows).toEqual(rows(expected.years));
  });

  it("projects a named entry", async () => {
    const out = await callOk("project_comp", { entry_id: FLAT_ID, years: 1 });
    expect(out.rows).toEqual(rows(projectComp(FLAT, { sharePrice: null, years: [2026], asOf: NOW_LOCAL }).years));
    expect(out).toMatchObject({ price_source: "none", has_vest_schedule: false });
  });

  it("reports an unknown (or another user's) entry as not found", async () => {
    expect(await callError("project_comp", { entry_id: UNKNOWN_ID })).toBe(MCP_COMP_MESSAGES.entryNotFound);
  });

  it("reports a missing current entry as not found", async () => {
    listReturns([]);
    expect(await callError("project_comp")).toBe(MCP_COMP_MESSAGES.noCurrentEntry);
  });

  it("refuses a share price for an entry without shares", async () => {
    expect(await callError("project_comp", { entry_id: FLAT_ID, share_price: 10 })).toBe(
      MCP_COMP_MESSAGES.sharePriceNeedsShares
    );
  });

  it.each([
    { years: 0 },
    { years: 11 },
    { years: 2.5 },
    { share_price: 0 },
    { share_price: 1_000_001 },
    { share_price: Number.POSITIVE_INFINITY },
    { share_price: Number.NaN },
    { entry_id: "not-a-uuid" },
  ])("rejects out-of-range input %p", async (args) => {
    expect(await callError("project_comp", args)).toMatch(INVALID_ARGUMENTS);
    expect(mockList).not.toHaveBeenCalled();
  });
});

// ── get_equity_quotes ──────────────────────────────────────────────────────

describe("get_equity_quotes", () => {
  it("returns cached quotes with ISO timestamps and lists missing tickers", async () => {
    const out = await callOk("get_equity_quotes");
    expect(mockReadQuotes).toHaveBeenCalledWith(TEST_ADMIN, ["ACME", "BETA"]);
    expect(out).toEqual({
      quotes: [
        {
          ticker: "ACME",
          price: 300,
          as_of: "2026-09-23T06:00:00.000Z",
          change: 1.5,
          change_pct: 0.5,
          previous_close: 298.5,
          company_name: "Acme",
          exchange: "NASDAQ",
          market_cap_musd: 1000,
        },
      ],
      missing: ["BETA"],
    });
  });

  it("lists a ticker the cache dropped (unusable price or time) as missing", async () => {
    quotesReturn({});
    const out = await callOk("get_equity_quotes");
    expect(out).toEqual({ quotes: [], missing: ["ACME", "BETA"] });
  });

  it("reports a cache read failure as an error", async () => {
    mockReadQuotes.mockResolvedValue({ ok: false, kind: "db", message: "Failed to load stock quotes" });
    expect(await callError("get_equity_quotes")).toBe("Failed to load stock quotes");
  });
});

// ── get_market_benchmark ───────────────────────────────────────────────────

describe("get_market_benchmark", () => {
  it("refuses non-Pro users by naming the plan, without reading comp", async () => {
    mockIsPro.mockResolvedValue({ ok: true, value: false });
    const text = await callError("get_market_benchmark", { role_family: "software_engineer", level: "senior" });
    expect(text).toBe("The market benchmark requires CareerOtter Pro.");
    expect(mockList).not.toHaveBeenCalled();
  });

  it("reports a plan lookup failure as an error", async () => {
    mockIsPro.mockResolvedValue({ ok: false, kind: "db", message: "Failed to look up plan" });
    expect(await callError("get_market_benchmark", { role_family: "design", level: "mid" })).toBe(
      "Failed to look up plan"
    );
  });

  it("returns range: null with a reason when there is no curated data", async () => {
    const out = await callOk("get_market_benchmark", { role_family: "product_manager", level: "junior" });
    expect(out).toEqual({
      role_family: "product_manager",
      level: "junior",
      as_of: TODAY,
      source: MARKET_DATA_SOURCE,
      range: null,
      reason: MCP_COMP_MESSAGES.noMarketData,
      current_total: null,
      ...NO_QUOTE,
      delta: null,
    });
  });

  it("compares the current annual total at the anchor price with the range", async () => {
    const range = lookupMarketRange("software_engineer", "senior");
    if (range === null) throw new Error("fixture range missing");
    const total = annualBreakdown(CURRENT, 300).total;
    const out = await callOk("get_market_benchmark", { role_family: "software_engineer", level: "senior" });
    expect(out).toMatchObject({
      range: { label: range.label, low: range.low, mid: range.mid, high: range.high, currency: "USD" },
      reason: null,
      current_total: total,
      ...FRESH_QUOTE,
      delta: compDelta(total, range),
    });
  });

  it("returns delta: null when no entry is in effect", async () => {
    listReturns([]);
    const out = await callOk("get_market_benchmark", { role_family: "data", level: "senior" });
    expect(out).toMatchObject({ current_total: null, delta: null, ...NO_QUOTE });
    expect(out.range).not.toBeNull();
  });

  it("only accepts the listed role families and levels", async () => {
    expect(await callError("get_market_benchmark", { role_family: "chef", level: "senior" })).toMatch(
      INVALID_ARGUMENTS
    );
  });
});

// ── evaluate_offer ─────────────────────────────────────────────────────────

describe("evaluate_offer", () => {
  const OFFER = {
    base: 200_000,
    bonus: 20_000,
    ticker: "newco",
    shares: 2000,
    vest_years: 4,
    vest_cliff_months: 12,
  };
  const FOUR_YEARS = [2026, 2027, 2028, 2029];

  function offerEntry(asOf: string, overrides: Partial<CompEntry> = {}): CompEntry {
    return {
      id: "offer",
      effective_date: asOf,
      base: 200_000,
      bonus: 20_000,
      equity: 0,
      currency: "USD",
      note: null,
      ticker: "NEWCO",
      shares: 2000,
      vest_start: asOf,
      vest_years: 4,
      vest_cliff_months: 12,
      ...overrides,
    };
  }

  it("compares each share-price scenario with the current package", async () => {
    const out = await callOk("evaluate_offer", { packages: [{ ...OFFER, share_prices: [10, 50, 120] }] });
    const baselineTotal = projectedTotal(CURRENT, 300, FOUR_YEARS, NOW_LOCAL);
    expect(out.baseline).toMatchObject({
      kind: "current",
      label: MCP_OFFER_CURRENT_LABEL,
      entry_id: CURRENT_ID,
      share_price: 300,
      price_source: "quote",
      ...FRESH_QUOTE,
      total: baselineTotal,
    });
    const [pkg] = recordsField(out, "packages");
    expect(pkg.label).toBe("Package A");
    const scenarios = recordsField(pkg, "scenarios");
    expect(scenarios).toHaveLength(3);
    [10, 50, 120].forEach((price, index) => {
      const entry = offerEntry(TODAY);
      const total = projectedTotal(entry, price, FOUR_YEARS, NOW_LOCAL);
      expect(scenarios[index]).toEqual({
        share_price: price,
        price_source: "given",
        ...NO_QUOTE,
        rows: rows(projectComp(entry, { sharePrice: price, years: FOUR_YEARS, asOf: NOW_LOCAL }).years),
        total,
        delta: total - baselineTotal,
      });
    });
    expect(out.not_modeled).toEqual([...MCP_OFFER_NOT_MODELED]);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("uses package A as the baseline when there is no current entry", async () => {
    listReturns([]);
    const out = await callOk("evaluate_offer", {
      packages: [
        { ...OFFER, share_prices: [40, 80] },
        { label: "Big co", base: 230_000, equity: 100_000, share_prices: [] },
      ],
    });
    const aTotal = projectedTotal(offerEntry(TODAY), 40, FOUR_YEARS, NOW_LOCAL);
    const bEntry = offerEntry(TODAY, {
      base: 230_000,
      bonus: 0,
      equity: 100_000,
      ticker: null,
      shares: null,
      vest_years: null,
      vest_cliff_months: null,
    });
    const bTotal = projectedTotal(bEntry, null, FOUR_YEARS, NOW_LOCAL);
    expect(out.baseline).toMatchObject({ kind: "package", label: "Package A", entry_id: null, share_price: 40, total: aTotal });
    const [a, b] = recordsField(out, "packages");
    expect(recordsField(a, "scenarios").map((scenario) => scenario.delta)).toEqual([
      0,
      projectedTotal(offerEntry(TODAY), 80, FOUR_YEARS, NOW_LOCAL) - aTotal,
    ]);
    expect(b.label).toBe("Big co");
    expect(recordsField(b, "scenarios")).toEqual([
      expect.objectContaining({ share_price: null, price_source: "none", total: bTotal, delta: bTotal - aTotal }),
    ]);
  });

  it("never reads comp entries when compare_to_current is false", async () => {
    const out = await callOk("evaluate_offer", { packages: [OFFER], compare_to_current: false });
    expect(mockList).not.toHaveBeenCalled();
    expect(out.baseline).toMatchObject({ kind: "package", share_price: null, price_source: "none" });
  });

  it("anchors a package without share prices on its cached quote", async () => {
    quotesReturn({ ACME: ACME_QUOTE, NEWCO: { ...ACME_QUOTE, price: 25 } });
    const out = await callOk("evaluate_offer", { packages: [OFFER] });
    const [pkg] = recordsField(out, "packages");
    expect(recordsField(pkg, "scenarios")).toEqual([
      expect.objectContaining({ share_price: 25, price_source: "quote", ...FRESH_QUOTE }),
    ]);
  });

  it("pins the years and vest start to as_of", async () => {
    const asOf = "2025-01-01";
    const out = await callOk("evaluate_offer", { packages: [{ ...OFFER, share_prices: [30] }], as_of: asOf, years: 2 });
    expect(out.years).toEqual([2025, 2026]);
    const expected = projectComp(offerEntry(asOf), { sharePrice: 30, years: [2025, 2026], asOf: parseLocalDate(asOf) });
    const [pkg] = recordsField(out, "packages");
    expect(recordsField(pkg, "scenarios")[0].rows).toEqual(rows(expected.years));
    expect(out.baseline).toMatchObject({ total: projectedTotal(CURRENT, 300, [2025, 2026], parseLocalDate(asOf)) });
  });

  it("validates packages with the comp service rules", async () => {
    const text = await callError("evaluate_offer", { packages: [{ base: 100_000, vest_cliff_months: 12 }] });
    expect(text).toBe("Package A: vest_cliff_months requires vest_years");
  });

  it("refuses share prices for a package without shares", async () => {
    const text = await callError("evaluate_offer", { packages: [{ base: 100_000, share_prices: [10] }] });
    expect(text).toBe(`Package A: ${MCP_COMP_MESSAGES.scenariosNeedShares}`);
  });

  it.each([
    [[{ label: "Offer", base: 1 }, { label: "offer ", base: 2 }]],
    [[{ base: 1 }, { label: "Package A", base: 2 }]],
  ])("refuses two packages with the same label %#", async (packages) => {
    expect(await callError("evaluate_offer", { packages })).toBe(MCP_COMP_MESSAGES.duplicateLabel);
  });

  it("refuses the label reserved for the current package", async () => {
    const packages = [{ label: MCP_OFFER_CURRENT_LABEL.toUpperCase(), base: 1 }];
    expect(await callError("evaluate_offer", { packages })).toBe(MCP_COMP_MESSAGES.reservedLabel);
    expect(mockList).not.toHaveBeenCalled();
  });

  it.each([
    { packages: [] },
    { packages: [OFFER, OFFER, OFFER] },
    { packages: [{ ...OFFER, share_prices: [1, 2, 3, 4, 5, 6] }] },
    { packages: [{ ...OFFER, base: Number.POSITIVE_INFINITY }] },
    { packages: [{ ...OFFER, share_prices: [Number.NaN] }] },
    { packages: [{ ...OFFER, bonus: -1 }] },
  ])("rejects malformed packages %#", async (args) => {
    expect(await callError("evaluate_offer", args)).toMatch(INVALID_ARGUMENTS);
  });
});

// ── writes ─────────────────────────────────────────────────────────────────

describe("add_comp_entry", () => {
  const INPUT = { effective_date: "2026-09-01", base: 180_000, external_ref: "offer:beta" };

  it("creates with the agent source and returns the entry", async () => {
    mockCreate.mockResolvedValue({ ok: true, value: { entry: UPCOMING, duplicate: false } });
    const result = await call("add_comp_entry", INPUT);
    expect(mockCreate).toHaveBeenCalledWith(TEST_ADMIN, TEST_USER_ID, INPUT, { source: "agent" });
    expect(structuredOf(result)).toEqual({ entry: UPCOMING, duplicate: false });
    expect(textOf(result)).toBe(`Added comp entry ${UPCOMING_ID} effective ${UPCOMING.effective_date}.`);
  });

  it("says a duplicate was returned unchanged and points at update_comp_entry", async () => {
    mockCreate.mockResolvedValue({ ok: true, value: { entry: UPCOMING, duplicate: true } });
    const result = await call("add_comp_entry", INPUT);
    expect(structuredOf(result)).toMatchObject({ duplicate: true });
    expect(textOf(result)).toMatch(/returned unchanged and the new values were not applied/);
    expect(textOf(result)).toMatch(/update_comp_entry/);
  });

  it("passes service validation failures through", async () => {
    mockCreate.mockResolvedValue({ ok: false, kind: "validation", message: "base must be a non-negative number" });
    expect(await callError("add_comp_entry", INPUT)).toBe("base must be a non-negative number");
  });

  it.each([{ base: Number.POSITIVE_INFINITY }, { base: -5 }, { bonus: Number.NaN }])(
    "rejects non-finite or negative amounts %p",
    async (override) => {
      expect(await callError("add_comp_entry", { ...INPUT, ...override })).toMatch(INVALID_ARGUMENTS);
      expect(mockCreate).not.toHaveBeenCalled();
    }
  );
});

describe("update_comp_entry", () => {
  it("updates agent rows only, passing nulls through to clear fields", async () => {
    mockUpdate.mockResolvedValue({ ok: true, value: UPCOMING });
    const out = await callOk("update_comp_entry", { id: UPCOMING_ID, bonus: null, note: "Signed" });
    expect(mockUpdate).toHaveBeenCalledWith(
      TEST_ADMIN,
      TEST_USER_ID,
      UPCOMING_ID,
      { bonus: null, note: "Signed" },
      { onlySource: "agent" }
    );
    expect(out).toEqual({ entry: UPCOMING });
  });

  it("refuses an empty patch", async () => {
    expect(await callError("update_comp_entry", { id: UPCOMING_ID })).toBe(MCP_COMP_MESSAGES.emptyPatch);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("reports a manual or unknown row as not found", async () => {
    mockUpdate.mockResolvedValue({ ok: false, kind: "not_found", message: "Comp entry not found" });
    expect(await callError("update_comp_entry", { id: CURRENT_ID, base: 1 })).toBe("Comp entry not found");
  });
});

describe("delete_comp_entry", () => {
  const NOTHING_TO_DELETE = "Nothing to delete: no agent-created comp entry with that id.";

  it("deletes agent rows only", async () => {
    mockDelete.mockResolvedValue({ ok: true, value: { id: UPCOMING_ID } });
    const result = await call("delete_comp_entry", { id: UPCOMING_ID });
    expect(mockDelete).toHaveBeenCalledWith(TEST_ADMIN, TEST_USER_ID, UPCOMING_ID, { onlySource: "agent" });
    expect(structuredOf(result)).toEqual({ deleted_id: UPCOMING_ID, deleted: true });
    expect(textOf(result)).toBe(`Deleted comp entry ${UPCOMING_ID}.`);
  });

  it("succeeds with deleted: false for a manual or unknown row", async () => {
    mockDelete.mockResolvedValue({ ok: false, kind: "not_found", message: "Comp entry not found" });
    const result = await call("delete_comp_entry", { id: CURRENT_ID });
    expect(structuredOf(result)).toEqual({ deleted_id: CURRENT_ID, deleted: false });
    expect(textOf(result)).toBe(NOTHING_TO_DELETE);
  });

  it("treats a retry after a successful delete as a no-op success", async () => {
    mockDelete
      .mockResolvedValueOnce({ ok: true, value: { id: UPCOMING_ID } })
      .mockResolvedValueOnce({ ok: false, kind: "not_found", message: "Comp entry not found" });
    expect(await callOk("delete_comp_entry", { id: UPCOMING_ID })).toEqual({ deleted_id: UPCOMING_ID, deleted: true });
    expect(await callOk("delete_comp_entry", { id: UPCOMING_ID })).toEqual({ deleted_id: UPCOMING_ID, deleted: false });
  });

  it("still reports a database failure as an error", async () => {
    mockDelete.mockResolvedValue({ ok: false, kind: "db", message: "Failed to delete comp entry" });
    expect(await callError("delete_comp_entry", { id: UPCOMING_ID })).toBe("Failed to delete comp entry");
  });

  it("is not available to a comp:read token", async () => {
    const result = await call("delete_comp_entry", { id: CURRENT_ID }, ["comp:read"]);
    expect(result.isError).toBe(true);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
