// @jest-environment node
/**
 * On-demand quote cache: serves cached rows, refreshes missing or stale
 * tickers live and writes them back, and only reads the cache when the feed
 * is dark. readCachedQuotes is select-only: never the feed, never a write; it
 * normalizes tickers and drops rows without a usable price.
 */

import { loadQuotes, QUOTE_TTL_MS, readCachedQuotes } from "@/lib/careerotter/stock-price-cache";
import { fetchProfile, fetchQuote } from "@/lib/careerotter/stock-price";
import { loggerService } from "@/lib/services/logger.service";

jest.mock("@/lib/careerotter/stock-price", () => ({
  fetchQuote: jest.fn(),
  fetchProfile: jest.fn(),
  isPriceFeedConfigured: () => !!process.env.FINNHUB_API_KEY,
}));
jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const mockQuote = fetchQuote as jest.Mock;
const mockProfile = fetchProfile as jest.Mock;
const mockLogWarn = jest.mocked(loggerService.warn);
const ORIGINAL_KEY = process.env.FINNHUB_API_KEY;

/** A fake admin client: `.from("stock_prices").select().in()` resolves rows; upsert is recorded. */
function fakeAdmin(rows: unknown[], upsertError: unknown = null, readError: unknown = null) {
  const upsert = jest.fn().mockResolvedValue({ error: upsertError });
  const inFn = jest.fn().mockResolvedValue({ data: readError ? null : rows, error: readError });
  const select = jest.fn(() => ({ in: inFn }));
  const from = jest.fn(() => ({ select, upsert }));
  return { client: { from } as never, upsert, inFn };
}

const fresh = () => new Date().toISOString();
const stale = () => new Date(Date.now() - QUOTE_TTL_MS - 60_000).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FINNHUB_API_KEY = "test-key";
});
afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.FINNHUB_API_KEY;
  else process.env.FINNHUB_API_KEY = ORIGINAL_KEY;
});

it("returns nothing and touches nothing for no tickers", async () => {
  const { client, inFn } = fakeAdmin([]);
  expect(await loadQuotes(client, [])).toEqual({});
  expect(inFn).not.toHaveBeenCalled();
});

it("serves a fresh cached quote without calling the feed", async () => {
  const { client, upsert } = fakeAdmin([
    { ticker: "NET", price: "100.5", as_of: fresh(), change: "1.5", profile_as_of: fresh() },
  ]);
  const quotes = await loadQuotes(client, ["NET"]);
  expect(quotes.NET.price).toBe(100.5);
  expect(quotes.NET.change).toBe(1.5);
  expect(mockQuote).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
});

it("fetches a ticker with no cached row, with its profile, and caches it", async () => {
  const { client, upsert } = fakeAdmin([]);
  mockQuote.mockResolvedValue({ price: 42, change: -1, changePct: -2.3, previousClose: 43 });
  mockProfile.mockResolvedValue({
    name: "Acme",
    exchange: "NASDAQ NMS - GLOBAL MARKET",
    marketCapMusd: 12345,
    logoUrl: "https://logo.example/acme.png",
  });
  const quotes = await loadQuotes(client, ["ACME"]);
  expect(quotes.ACME).toMatchObject({
    price: 42,
    change: -1,
    change_pct: -2.3,
    previous_close: 43,
    company_name: "Acme",
    market_cap_musd: 12345,
    logo_url: "https://logo.example/acme.png",
  });
  expect(upsert).toHaveBeenCalledWith(
    expect.objectContaining({ ticker: "ACME", price: 42, company_name: "Acme" }),
    { onConflict: "ticker" }
  );
});

it("refreshes a stale quote but keeps the cached profile", async () => {
  const { client, upsert } = fakeAdmin([
    {
      ticker: "NET",
      price: "90",
      as_of: stale(),
      company_name: "Cloudflare",
      exchange: "NYSE",
      profile_as_of: fresh(),
    },
  ]);
  mockQuote.mockResolvedValue({ price: 95, change: 5, changePct: 5.5, previousClose: 90 });
  const quotes = await loadQuotes(client, ["NET"]);
  expect(quotes.NET.price).toBe(95);
  expect(quotes.NET.company_name).toBe("Cloudflare");
  expect(mockProfile).not.toHaveBeenCalled();
  expect(upsert).toHaveBeenCalledWith(
    expect.not.objectContaining({ company_name: expect.anything() }),
    { onConflict: "ticker" }
  );
});

it("keeps the stale cached quote when the feed returns nothing", async () => {
  const { client, upsert } = fakeAdmin([{ ticker: "NET", price: "90", as_of: stale() }]);
  mockQuote.mockResolvedValue(null);
  const quotes = await loadQuotes(client, ["NET"]);
  expect(quotes.NET.price).toBe(90);
  expect(upsert).not.toHaveBeenCalled();
});

it("still returns the fresh quote when the cache write fails", async () => {
  const { client } = fakeAdmin([], { message: "boom" });
  mockQuote.mockResolvedValue({ price: 7, change: null, changePct: null, previousClose: null });
  mockProfile.mockResolvedValue(null);
  const quotes = await loadQuotes(client, ["X"]);
  expect(quotes.X.price).toBe(7);
});

it("only reads the cache when the feed is dark", async () => {
  delete process.env.FINNHUB_API_KEY;
  const { client, upsert } = fakeAdmin([{ ticker: "NET", price: "90", as_of: stale() }]);
  const quotes = await loadQuotes(client, ["NET", "NEW"]);
  expect(quotes.NET.price).toBe(90);
  expect(quotes.NEW).toBeUndefined();
  expect(mockQuote).not.toHaveBeenCalled();
  expect(upsert).not.toHaveBeenCalled();
});

describe("readCachedQuotes", () => {
  const originalFetch = global.fetch;
  const fetchSpy = jest.fn();

  beforeEach(() => {
    global.fetch = fetchSpy;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns cached rows, even stale ones, without the feed or a write", async () => {
    const { client, upsert, inFn } = fakeAdmin([
      { ticker: "NET", price: "90", as_of: stale(), change: "1.5" },
    ]);
    const result = await readCachedQuotes(client, ["NET", "NEW", "NET"]);
    expect(result).toMatchObject({ ok: true, value: { NET: { price: 90, change: 1.5 } } });
    expect(result.ok && result.value.NEW).toBeFalsy();
    expect(inFn).toHaveBeenCalledWith("ticker", ["NET", "NEW"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockProfile).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("trims and uppercases tickers before de-duplicating and querying", async () => {
    const { client, inFn } = fakeAdmin([{ ticker: "NET", price: 90, as_of: fresh() }]);
    const result = await readCachedQuotes(client, [" net ", "NET", "brk.b", "  "]);
    expect(inFn).toHaveBeenCalledWith("ticker", ["NET", "BRK.B"]);
    expect(result).toMatchObject({ ok: true, value: { NET: { price: 90 } } });
  });

  it.each([null, "", "abc", "NaN", Number.NaN, Number.POSITIVE_INFINITY, undefined, 0, "0", -5, "-1.5"])(
    "drops a row whose price is %p and logs a warning",
    async (price) => {
      const { client } = fakeAdmin([
        { ticker: "BAD", price, as_of: fresh() },
        { ticker: "NET", price: "90.5", as_of: fresh() },
      ]);
      const result = await readCachedQuotes(client, ["BAD", "NET"]);
      expect(result).toEqual({ ok: true, value: { NET: expect.objectContaining({ price: 90.5 }) } });
      expect(mockLogWarn).toHaveBeenCalledWith(
        "Dropped malformed cached stock price rows",
        expect.objectContaining({ metadata: { dropped: 1 } })
      );
    }
  );

  it.each(["yesterday-ish", "", "2026-13-45T99:00:00Z"])(
    "drops a row whose as_of %p cannot be dated and logs a warning",
    async (asOf) => {
      const { client } = fakeAdmin([
        { ticker: "BAD", price: 10, as_of: asOf },
        { ticker: "NET", price: 90, as_of: fresh() },
      ]);
      const result = await readCachedQuotes(client, ["BAD", "NET"]);
      expect(result).toEqual({ ok: true, value: { NET: expect.objectContaining({ price: 90 }) } });
      expect(mockLogWarn).toHaveBeenCalledWith(
        "Dropped malformed cached stock price rows",
        expect.objectContaining({ metadata: { dropped: 1 } })
      );
    }
  );

  it("returns as_of as a UTC ISO timestamp, keyed by the normalized ticker", async () => {
    const { client } = fakeAdmin([{ ticker: "net ", price: 90, as_of: "2026-09-23T06:00:00+00:00" }]);
    const result = await readCachedQuotes(client, ["NET"]);
    expect(result).toMatchObject({ ok: true, value: { NET: { as_of: "2026-09-23T06:00:00.000Z" } } });
  });

  it("returns an empty map for no tickers without querying", async () => {
    const { client, inFn } = fakeAdmin([]);
    expect(await readCachedQuotes(client, [])).toEqual({ ok: true, value: {} });
    expect(await readCachedQuotes(client, ["  "])).toEqual({ ok: true, value: {} });
    expect(inFn).not.toHaveBeenCalled();
  });

  it("maps a read error to db", async () => {
    const { client, upsert } = fakeAdmin([], null, { message: "boom" });
    expect(await readCachedQuotes(client, ["NET"])).toEqual({
      ok: false,
      kind: "db",
      message: "Failed to load stock quotes",
    });
    expect(upsert).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
