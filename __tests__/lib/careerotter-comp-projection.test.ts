// @jest-environment node
/**
 * Comp projection math: the numbers the comp page shows, checked without
 * rendering. Vest boundaries are mid-year on purpose so the calendar-year
 * slices are unambiguous.
 */

import {
  anchorSharePrice,
  annualizedTotal,
  formatCompactUsd,
  formatSignedPct,
  formatSignedUsd,
  grantFractionReceivedInYear,
  niceTicks,
  projectComp,
  scenarioTotal,
  vestSummary,
  vestedFractionAt,
  type CompEntry,
  type StockQuote,
} from "@/lib/careerotter/comp-projection";

const entry = (overrides: Partial<CompEntry> = {}): CompEntry => ({
  id: "e1",
  effective_date: "2026-03-01",
  base: 155_000,
  bonus: 37_000,
  equity: 0,
  currency: "USD",
  note: null,
  ticker: "NET",
  shares: 1_200,
  vest_start: "2026-03-01",
  vest_years: 4,
  vest_cliff_months: 12,
  ...overrides,
});

const quote = (price: number): StockQuote => ({
  price,
  as_of: "2026-09-22T06:00:00Z",
  change: null,
  change_pct: null,
  previous_close: null,
  company_name: null,
  exchange: null,
  market_cap_musd: null,
  logo_url: null,
});

const asOf = new Date("2026-09-22T12:00:00");

describe("vestedFractionAt", () => {
  const schedule = { start: new Date("2026-03-01T00:00:00"), vestYears: 4, cliffMonths: 12 };

  it("is zero before the cliff and the accrued lump on the cliff day", () => {
    expect(vestedFractionAt(new Date("2027-02-28T23:59:59"), schedule)).toBe(0);
    // Vesting is linear in time, so twelve of forty-eight months is 0.25 give or
    // take the uneven month lengths.
    expect(vestedFractionAt(new Date("2027-03-01T00:00:00"), schedule)).toBeCloseTo(0.25, 2);
  });

  it("is one from the end of the vest onward", () => {
    expect(vestedFractionAt(new Date("2030-03-01T00:00:00"), schedule)).toBe(1);
    expect(vestedFractionAt(new Date("2031-01-01T00:00:00"), schedule)).toBe(1);
  });

  it("keeps the calendar-year helper's semantics", () => {
    const start = new Date("2026-01-01T00:00:00");
    expect(grantFractionReceivedInYear(2027, start, 4, 0)).toBeCloseTo(0.25, 2);
  });
});

describe("projectComp", () => {
  it("splits each year's stock into vested-to-date and still-unvested", () => {
    const p = projectComp(entry(), { sharePrice: 250, years: [2026, 2027, 2028], asOf });
    expect(p.hasVestSchedule).toBe(true);
    expect(p.grantValue).toBe(300_000);

    const [y26, y27, y28] = p.years;
    // Nothing vests in 2026: the cliff is March 2027.
    expect(y26.stock).toBe(0);
    expect(y26.total).toBe(192_000);
    // 2027 receives the cliff lump plus ten more months: 22/48 of the grant, all in the future.
    expect(y27.stock).toBeCloseTo((300_000 * 22) / 48, -3);
    expect(y27.stockVested).toBe(0);
    expect(y27.stockUnvested).toBeCloseTo((300_000 * 22) / 48, -3);
    // A full mid-vest year is a quarter of the grant.
    expect(y28.stock).toBeCloseTo(75_000, -3);
    expect(y28.total).toBeCloseTo(267_000, -3);
  });

  it("counts what has already vested this year as vested", () => {
    const later = new Date("2027-06-01T12:00:00");
    const [y27] = projectComp(entry(), { sharePrice: 250, years: [2027], asOf: later }).years;
    // Mar 2026 -> Jun 2027 is 15 of 48 months vested, all of it inside 2027.
    expect(y27.stockVested).toBeCloseTo((300_000 * 15) / 48, -3);
    expect(y27.stockUnvested).toBeCloseTo((300_000 * 7) / 48, -3);
  });

  it("carries a flat grant every year without a schedule", () => {
    const flat = entry({ shares: null, ticker: null, equity: 40_000, vest_years: null, vest_start: null, vest_cliff_months: null });
    const p = projectComp(flat, { sharePrice: null, years: [2026, 2027], asOf });
    expect(p.hasVestSchedule).toBe(false);
    expect(p.years.map((y) => y.stock)).toEqual([40_000, 40_000]);
    expect(p.years[0].total).toBe(232_000);
  });

  it("values shares at zero when no price is known", () => {
    const p = projectComp(entry({ equity: 0 }), { sharePrice: null, years: [2028], asOf });
    expect(p.years[0].stock).toBe(0);
  });
});

describe("annualizedTotal and scenarioTotal", () => {
  it("spreads a vesting grant evenly for the headline number", () => {
    expect(annualizedTotal(entry(), 250)).toBe(155_000 + 37_000 + 75_000);
  });

  it("counts a flat grant in full", () => {
    const flat = entry({ shares: null, equity: 40_000, vest_years: null });
    expect(annualizedTotal(flat, null)).toBe(232_000);
  });

  it("scenarioTotal is this year's projected total at the price", () => {
    expect(scenarioTotal(entry(), 250, asOf)).toBe(192_000);
  });
});

describe("anchorSharePrice", () => {
  it("prefers the live quote, then the price the recorded equity implies", () => {
    expect(anchorSharePrice(entry(), quote(351.67))).toBe(351.67);
    expect(anchorSharePrice(entry({ equity: 240_000 }), null)).toBe(200);
  });

  it("is null when nothing says what a share is worth, or there are no shares", () => {
    expect(anchorSharePrice(entry({ equity: 0 }), null)).toBeNull();
    expect(anchorSharePrice(entry({ shares: null, equity: 40_000 }), quote(10))).toBeNull();
  });
});

describe("vestSummary", () => {
  it("reports the cliff lump and the end of the vest before the cliff", () => {
    const s = vestSummary(entry(), 250, asOf);
    expect(s).not.toBeNull();
    expect(s!.cliffPassed).toBe(false);
    expect(s!.cliffValue).toBeCloseTo(75_000, -3);
    expect(s!.vestedValue).toBe(0);
    expect(s!.unvestedValue).toBe(300_000);
    expect(s!.fullyVestedDate.getFullYear()).toBe(2030);
  });

  it("is null without a schedule", () => {
    expect(vestSummary(entry({ vest_years: null }), 250, asOf)).toBeNull();
  });
});

describe("formatting", () => {
  it("compacts dollars the way a comp table reads", () => {
    expect(formatCompactUsd(950)).toBe("$950");
    expect(formatCompactUsd(46_500)).toBe("$46.5K");
    expect(formatCompactUsd(46_000)).toBe("$46K");
    expect(formatCompactUsd(155_000)).toBe("$155K");
    expect(formatCompactUsd(392_000)).toBe("$392K");
    expect(formatCompactUsd(1_250_000)).toBe("$1.25M");
    expect(formatCompactUsd(88_000_000_000)).toBe("$88B");
    expect(formatCompactUsd(-104)).toBe("-$104");
  });

  it("signs deltas", () => {
    expect(formatSignedUsd(28.07, true)).toBe("+$28.07");
    expect(formatSignedUsd(-104)).toBe("-$104");
    expect(formatSignedUsd(0)).toBe("$0");
    expect(formatSignedPct(8.67, 2)).toBe("+8.67%");
    expect(formatSignedPct(-29.6)).toBe("-29.6%");
  });

  it("rounds axis ticks to clean steps", () => {
    expect(niceTicks(392_000)).toEqual([0, 100_000, 200_000, 300_000, 400_000]);
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(7_200)).toEqual([0, 2_000, 4_000, 6_000, 8_000]);
  });
});
