// @jest-environment node
/**
 * The one comp-entry contract, shared by the form, the guest cache and the
 * POST route: what one accepts, all accept.
 */

import { validateCompEntryInput } from "@/lib/careerotter/comp-entry-validation";
import { COMP_LIMITS } from "@/lib/constants/careerotter";

const good = {
  effective_date: "2026-03-01",
  base: 155_000,
  bonus: 37_000,
  equity: 0,
  ticker: " net ",
  shares: 1_200,
  vest_start: "2026-03-01",
  vest_years: 4,
  vest_cliff_months: 12,
};

it("normalizes a valid entry the way the API stores it", () => {
  const result = validateCompEntryInput({ ...good, note: "  Senior offer  " });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value).toEqual({ ...good, ticker: "NET" });
  expect(result.note).toBe("Senior offer");
});

it("applies the API's defaults to absent optional fields", () => {
  const result = validateCompEntryInput({ effective_date: "2026-03-01", base: 90_000 });
  expect(result).toEqual({
    ok: true,
    note: null,
    value: {
      effective_date: "2026-03-01",
      base: 90_000,
      bonus: 0,
      equity: 0,
      ticker: null,
      shares: null,
      vest_start: null,
      vest_years: null,
      vest_cliff_months: null,
    },
  });
});

it.each([
  ["a non-object", "nope"],
  ["an impossible date", { ...good, effective_date: "2026-02-30" }],
  ["a negative base", { ...good, base: -1 }],
  ["shares past the column's ceiling", { ...good, shares: COMP_LIMITS.sharesMax + 1 }],
  ["a vest longer than ten years", { ...good, vest_years: 11 }],
  ["a fractional cliff", { ...good, vest_cliff_months: 1.5 }],
  ["a cliff without a vest", { ...good, vest_years: null, vest_cliff_months: 12 }],
  ["a cliff longer than the vest", { ...good, vest_years: 1, vest_cliff_months: 24 }],
  ["a vest shorter than one month", { ...good, vest_years: 0.08, vest_cliff_months: 0 }],
  ["a base past numeric(12,2)", { ...good, base: COMP_LIMITS.amountMax + 1 }],
  ["a bonus past numeric(12,2)", { ...good, bonus: COMP_LIMITS.amountMax + 1 }],
  ["a ticker longer than the cap", { ...good, ticker: "ABCDEFGHIJK" }],
  ["a ticker outside the charset", { ...good, ticker: "NE$T" }],
  ["a ticker starting with a dot", { ...good, ticker: ".NET" }],
  ["a ticker with a NUL", { ...good, ticker: "NE\u0000T" }],
  ["a note with a NUL", { ...good, note: "a\u0000b" }],
])("rejects %s", (_label, body) => {
  expect(validateCompEntryInput(body).ok).toBe(false);
});

it("names the stricter rules in its messages, so the form can show them", () => {
  expect(validateCompEntryInput({ ...good, ticker: "ABCDEFGHIJK" })).toEqual({
    ok: false,
    error: "ticker must be 1-10 letters, digits, dots or hyphens",
  });
  expect(validateCompEntryInput({ ...good, vest_years: 0.05, vest_cliff_months: 0 })).toEqual({
    ok: false,
    error: "vest_years must be at least 0.09 (one month) and at most 10",
  });
  expect(validateCompEntryInput({ ...good, equity: COMP_LIMITS.amountMax + 1 })).toEqual({
    ok: false,
    error: "equity must be no larger than 9,999,999,999.99",
  });
});

it("accepts the shortest vest and caps the note by code point", () => {
  const note = `${"n".repeat(COMP_LIMITS.noteMax - 1)}\u{1F600}\u{1F600}`;
  const result = validateCompEntryInput({
    ...good,
    vest_years: COMP_LIMITS.vestYearsMin,
    vest_cliff_months: 0,
    note,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.vest_years).toBe(COMP_LIMITS.vestYearsMin);
  expect(result.note).toBe(`${"n".repeat(COMP_LIMITS.noteMax - 1)}\u{1F600}`);
});
