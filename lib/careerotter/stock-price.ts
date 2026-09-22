/**
 * Finnhub price feed (CareerOtter comp equity, Phase 2).
 *
 * The whole feature is DARK until FINNHUB_API_KEY is set: with no key, both the
 * polling cron and any lookup no-op cleanly (fetchQuote / fetchProfile return
 * null, isPriceFeedConfigured returns false). Public tickers only.
 */

const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";
const FINNHUB_PROFILE_URL = "https://finnhub.io/api/v1/stock/profile2";
const QUOTE_TIMEOUT_MS = 8000;

/** Whether the live price feed is enabled (an API key is configured). */
export function isPriceFeedConfigured(): boolean {
  return !!process.env.FINNHUB_API_KEY;
}

export interface Quote {
  price: number;
  /** Day's move in dollars, when Finnhub reports one. */
  change: number | null;
  /** Day's move in percent, when Finnhub reports one. */
  changePct: number | null;
  previousClose: number | null;
}

export interface CompanyProfile {
  name: string | null;
  exchange: string | null;
  /** Market capitalization in millions of USD. */
  marketCapMusd: number | null;
  logoUrl: string | null;
}

/** The value when it is a finite number, else null. */
const finite = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** GET a Finnhub endpoint for a ticker; null on any failure or without a key. */
async function finnhubGet(url: string, ticker: string): Promise<unknown | null> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return null;
  try {
    const full = `${url}?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(token)}`;
    const res = await fetch(full, { signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch the current quote for a public ticker from Finnhub.
 * Returns a quote only when the current price is a finite number > 0, else null.
 * Never throws: any missing key, network error, timeout, or bad payload → null.
 */
export async function fetchQuote(ticker: string): Promise<Quote | null> {
  const data = (await finnhubGet(FINNHUB_QUOTE_URL, ticker)) as {
    c?: unknown;
    d?: unknown;
    dp?: unknown;
    pc?: unknown;
  } | null;
  const price = finite(data?.c);
  if (price === null || price <= 0) return null;
  const previousClose = finite(data?.pc);
  return {
    price,
    change: finite(data?.d),
    changePct: finite(data?.dp),
    previousClose: previousClose !== null && previousClose > 0 ? previousClose : null,
  };
}

/**
 * Fetch the company profile behind a ticker (name, exchange, market cap, logo).
 * Returns null when nothing useful came back; never throws.
 */
export async function fetchProfile(ticker: string): Promise<CompanyProfile | null> {
  const data = (await finnhubGet(FINNHUB_PROFILE_URL, ticker)) as {
    name?: unknown;
    exchange?: unknown;
    marketCapitalization?: unknown;
    logo?: unknown;
  } | null;
  if (!data) return null;
  /** A trimmed, bounded string, or null when empty or not a string. */
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim().length > 0 ? v.trim().slice(0, 200) : null;
  const logo = str(data.logo);
  const profile: CompanyProfile = {
    name: str(data.name),
    exchange: str(data.exchange),
    marketCapMusd: finite(data.marketCapitalization),
    // Only an https URL is worth rendering as an image on the page.
    logoUrl: logo && /^https:\/\//i.test(logo) ? logo : null,
  };
  if (!profile.name && !profile.exchange && profile.marketCapMusd === null) return null;
  return profile;
}
