/**
 * Public cached-quote endpoint for the guest comp page: no auth, cache
 * reads only, tickers normalized and capped.
 */

import { GET } from "@/app/api/careerotter/stock-price/route";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));

const mockAdmin = createAdminClient as jest.Mock;

function adminReturning(rows: unknown[]) {
  const b: Record<string, unknown> = {};
  for (const m of ["from", "select"]) b[m] = jest.fn(() => b);
  b.in = jest.fn(() => Promise.resolve({ data: rows, error: null }));
  mockAdmin.mockReturnValue(b);
  return b;
}

const req = (qs: string) => new NextRequest(`http://localhost:3000/api/careerotter/stock-price${qs}`);

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.FINNHUB_API_KEY;
});

it("returns cached quotes for normalized tickers", async () => {
  const b = adminReturning([
    { ticker: "NET", price: "351.67", as_of: "2026-09-22T06:00:00Z", change: "28.07", change_pct: "8.67", previous_close: null, company_name: "Cloudflare Inc", exchange: null, market_cap_musd: "88000", logo_url: null },
  ]);
  const res = await GET(req("?tickers=net,%20aapl,net"));
  const json = await res.json();
  expect(b.in).toHaveBeenCalledWith("ticker", ["NET", "AAPL"]);
  expect(json.prices.NET).toMatchObject({ price: 351.67, change: 28.07, previous_close: null, market_cap_musd: 88000 });
  expect(json.priceFeedEnabled).toBe(false);
});

it("caps the list and ignores junk, without touching the database when nothing is left", async () => {
  const b = adminReturning([]);
  await GET(req("?tickers=A,B,C,D,E,F,G"));
  expect((b.in as jest.Mock).mock.calls[0][1]).toHaveLength(5);

  mockAdmin.mockClear();
  const res = await GET(req("?tickers=not%20a%20ticker,%3Cscript%3E"));
  expect(await res.json()).toEqual({ prices: {}, priceFeedEnabled: false });
  expect(mockAdmin).not.toHaveBeenCalled();
});
