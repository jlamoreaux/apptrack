// @jest-environment node
/**
 * On-demand quote cache: serves cached rows, refreshes missing or stale
 * tickers live and writes them back, and only reads the cache when the feed
 * is dark.
 */

import { loadQuotes, QUOTE_TTL_MS } from "@/lib/careerotter/stock-price-cache";
import { fetchProfile, fetchQuote } from "@/lib/careerotter/stock-price";

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
const ORIGINAL_KEY = process.env.FINNHUB_API_KEY;

/** A fake admin client: `.from("stock_prices").select().in()` resolves rows; upsert is recorded. */
function fakeAdmin(rows: unknown[], upsertError: unknown = null) {
  const upsert = jest.fn().mockResolvedValue({ error: upsertError });
  const inFn = jest.fn().mockResolvedValue({ data: rows, error: null });
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
