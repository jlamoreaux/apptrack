/**
 * Ticker normalization shared by the comp API, the public quote endpoint and
 * the guest page. Kept free of server imports so the client can use it.
 */

const TICKER = /^[A-Z0-9.-]{1,10}$/;

/** Uppercase, trimmed, deduplicated tickers that look like tickers, in the order given. */
export function normalizeTickers(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const ticker = typeof value === "string" ? value.trim().toUpperCase() : "";
    if (ticker && TICKER.test(ticker)) seen.add(ticker);
  }
  return [...seen];
}

/** Split a list into batches of at most `size`, keeping order. */
export function batchTickers(tickers: string[], size: number): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < tickers.length; i += size) batches.push(tickers.slice(i, i + size));
  return batches;
}
