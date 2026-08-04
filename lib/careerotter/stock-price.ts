/**
 * Finnhub price feed (CareerOtter comp equity, Phase 2).
 *
 * The whole feature is DARK until FINNHUB_API_KEY is set: with no key, both the
 * polling cron and any lookup no-op cleanly (fetchQuote returns null,
 * isPriceFeedConfigured returns false). Public tickers only.
 */

const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";
const QUOTE_TIMEOUT_MS = 8000;

/** Whether the live price feed is enabled (an API key is configured). */
export function isPriceFeedConfigured(): boolean {
  return !!process.env.FINNHUB_API_KEY;
}

/**
 * Fetch the current price for a public ticker from Finnhub.
 * Returns the current price only when it is a finite number > 0, else null.
 * Never throws: any missing key, network error, timeout, or bad payload → null.
 */
export async function fetchQuote(ticker: string): Promise<number | null> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) return null;

  try {
    const url = `${FINNHUB_QUOTE_URL}?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS) });
    if (!res.ok) return null;

    const data = (await res.json()) as { c?: unknown };
    const price = data?.c;
    if (typeof price === "number" && Number.isFinite(price) && price > 0) {
      return price;
    }
    return null;
  } catch {
    return null;
  }
}
