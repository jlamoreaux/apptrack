// @jest-environment node
/**
 * The one comp-entry contract, shared by the form, the guest cache and the
 * POST route: what one accepts, all accept.
 */

import { validateCompEntryInput } from "@/lib/careerotter/comp-entry-validation";
import { COMP_ENTRY_LIMITS } from "@/lib/constants/careerotter";

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
  ["shares past the column's ceiling", { ...good, shares: COMP_ENTRY_LIMITS.sharesMax + 1 }],
  ["a vest longer than ten years", { ...good, vest_years: 11 }],
  ["a fractional cliff", { ...good, vest_cliff_months: 1.5 }],
  ["a cliff without a vest", { ...good, vest_years: null, vest_cliff_months: 12 }],
  ["a cliff longer than the vest", { ...good, vest_years: 1, vest_cliff_months: 24 }],
])("rejects %s", (_label, body) => {
  expect(validateCompEntryInput(body).ok).toBe(false);
});
