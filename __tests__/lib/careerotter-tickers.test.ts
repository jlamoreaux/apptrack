// @jest-environment node
/**
 * Ticker normalization and batching shared by the comp API, the public quote
 * endpoint and the guest page.
 */

import { batchTickers, normalizeTickers } from "@/lib/careerotter/tickers";

it("uppercases, trims, dedupes and keeps order", () => {
  expect(normalizeTickers([" net ", "aapl", "NET", null, undefined, "", "not a ticker"])).toEqual([
    "NET",
    "AAPL",
  ]);
});

it("batches in order so the first ticker is always in the first request", () => {
  const seven = ["A", "B", "C", "D", "E", "F", "G"];
  expect(batchTickers(seven, 5)).toEqual([["A", "B", "C", "D", "E"], ["F", "G"]]);
  expect(batchTickers([], 5)).toEqual([]);
});
