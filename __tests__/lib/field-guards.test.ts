// @jest-environment node
/**
 * Tests for the field guards added for OAuth registration in
 * lib/careerotter/field-guards.ts: isStringArray, isWellFormedUtf16 and
 * truncateGraphemes (never splits a grapheme, bounded by both graphemes and
 * code points).
 */

import {
  isStringArray,
  isWellFormedUtf16,
  truncateGraphemes,
} from "@/lib/careerotter/field-guards";

describe("isStringArray", () => {
  it("accepts only arrays of strings", () => {
    expect(isStringArray([])).toBe(true);
    expect(isStringArray(["a", ""])).toBe(true);
    expect(isStringArray(["a", 1])).toBe(false);
    expect(isStringArray("a")).toBe(false);
    expect(isStringArray(null)).toBe(false);
  });
});

describe("isWellFormedUtf16", () => {
  it("rejects lone surrogates and accepts pairs", () => {
    expect(isWellFormedUtf16("plain")).toBe(true);
    expect(isWellFormedUtf16("\u{1F9A6}")).toBe(true);
    expect(isWellFormedUtf16("a\uD83D")).toBe(false);
    expect(isWellFormedUtf16("\uDEA6a")).toBe(false);
    expect(isWellFormedUtf16("\uDEA6\uD83D")).toBe(false);
  });
});

describe("truncateGraphemes", () => {
  const family = "\u{1F468}‍\u{1F469}‍\u{1F467}";

  it("keeps whole graphemes up to the limit", () => {
    expect(truncateGraphemes("abcdef", 3)).toBe("abc");
    expect(truncateGraphemes("ab", 3)).toBe("ab");
    expect(truncateGraphemes(`a${family}`, 2)).toBe("a");
  });

  it("stops before a grapheme that would pass the code-point limit", () => {
    expect(truncateGraphemes(`${family}b`, 5)).toBe(family);
    expect(truncateGraphemes(`${family}b`, 6)).toBe(`${family}b`);
    expect(truncateGraphemes("q́", 1)).toBe("");
  });
});
