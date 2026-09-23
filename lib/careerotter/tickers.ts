/**
 * Ticker normalization shared by the comp API, the public quote endpoint, the
 * guest page, the entry validator and the MCP tools. Kept free of server
 * imports so the client can use it.
 */

import { COMP_LIMITS } from "@/lib/constants/careerotter";

/**
 * What a stored ticker looks like once trimmed and uppercased: letters, digits,
 * dots or hyphens, starting with a letter or digit, at most COMP_LIMITS.tickerMax
 * characters.
 */
export const TICKER_PATTERN = new RegExp(
  `^[A-Z0-9][A-Z0-9.\\-]{0,${COMP_LIMITS.tickerMax - 1}}$`
);

/** A ticker as stored: trimmed and uppercased. */
export function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

/** Uppercase, trimmed, deduplicated tickers that look like tickers, in the order given. */
export function normalizeTickers(values: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const ticker = typeof value === "string" ? normalizeTicker(value) : "";
    if (TICKER_PATTERN.test(ticker)) seen.add(ticker);
  }
  return [...seen];
}

/** Split a list into batches of at most `size`, keeping order. */
export function batchTickers(tickers: string[], size: number): string[][] {
  const batches: string[][] = [];
  for (let i = 0; i < tickers.length; i += size) batches.push(tickers.slice(i, i + size));
  return batches;
}
