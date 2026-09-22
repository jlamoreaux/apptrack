// @jest-environment node
/**
 * Finnhub client: dark without a key, tolerant of bad payloads, and maps the
 * quote and profile fields the comp page shows.
 */

import { fetchProfile, fetchQuote, isPriceFeedConfigured } from "@/lib/careerotter/stock-price";

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const ORIGINAL_KEY = process.env.FINNHUB_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.FINNHUB_API_KEY;
  else process.env.FINNHUB_API_KEY = ORIGINAL_KEY;
});

function respond(body: unknown, ok = true) {
  mockFetch.mockResolvedValueOnce({ ok, json: async () => body });
}

describe("without FINNHUB_API_KEY", () => {
  beforeEach(() => {
    delete process.env.FINNHUB_API_KEY;
  });

  it("is dark: no calls, null results", async () => {
    expect(isPriceFeedConfigured()).toBe(false);
    expect(await fetchQuote("NET")).toBeNull();
    expect(await fetchProfile("NET")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("with FINNHUB_API_KEY", () => {
  beforeEach(() => {
    process.env.FINNHUB_API_KEY = "test-key";
  });

  it("maps the quote's price, day move and previous close", async () => {
    respond({ c: 351.67, d: 28.07, dp: 8.67, pc: 323.6 });
    expect(await fetchQuote("NET")).toEqual({
      price: 351.67,
      change: 28.07,
      changePct: 8.67,
      previousClose: 323.6,
    });
    expect(mockFetch.mock.calls[0][0]).toContain("symbol=NET");
  });

  it("tolerates a quote with only a price", async () => {
    respond({ c: 12.5 });
    expect(await fetchQuote("X")).toEqual({
      price: 12.5,
      change: null,
      changePct: null,
      previousClose: null,
    });
  });

  it("returns null for an unknown ticker (Finnhub reports zeros) or a failed call", async () => {
    respond({ c: 0, d: null, dp: null, pc: 0 });
    expect(await fetchQuote("NOPE")).toBeNull();
    respond({}, false);
    expect(await fetchQuote("NET")).toBeNull();
    mockFetch.mockRejectedValueOnce(new Error("network"));
    expect(await fetchQuote("NET")).toBeNull();
  });

  it("maps the profile and keeps only an https logo", async () => {
    respond({
      name: "Cloudflare Inc",
      exchange: "NEW YORK STOCK EXCHANGE, INC.",
      marketCapitalization: 88_000,
      logo: "https://static.finnhub.io/logo/net.png",
    });
    expect(await fetchProfile("NET")).toEqual({
      name: "Cloudflare Inc",
      exchange: "NEW YORK STOCK EXCHANGE, INC.",
      marketCapMusd: 88_000,
      logoUrl: "https://static.finnhub.io/logo/net.png",
    });

    respond({ name: "Example", logo: "http://insecure.example/logo.png" });
    expect((await fetchProfile("EX"))?.logoUrl).toBeNull();
  });

  it("returns null for an empty profile", async () => {
    respond({});
    expect(await fetchProfile("NOPE")).toBeNull();
  });
});
