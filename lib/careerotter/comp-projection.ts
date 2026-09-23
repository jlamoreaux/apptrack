/**
 * Comp projection math (CareerOtter comp tracker).
 *
 * Pure functions only, so the numbers the page shows are unit-testable without
 * rendering anything. Everything here models a single comp entry: base and
 * bonus carried flat, equity either as a flat amount or as shares at a price,
 * optionally spread across a linear vesting schedule with a cliff.
 */

export interface CompEntry {
  id: string;
  effective_date: string;
  base: number;
  bonus: number;
  equity: number;
  currency: string;
  note: string | null;
  ticker: string | null;
  shares: number | null;
  vest_start: string | null;
  vest_years: number | null;
  vest_cliff_months: number | null;
}

/** A cached quote row from stock_prices, as the comp API returns it. */
export interface StockQuote {
  price: number;
  as_of: string;
  change: number | null;
  change_pct: number | null;
  previous_close: number | null;
  company_name: string | null;
  exchange: string | null;
  /** Market capitalization in millions of USD, as Finnhub reports it. */
  market_cap_musd: number | null;
  logo_url: string | null;
}

/**
 * Add calendar months to a date, clamping the day to the target month's last
 * day. Plain Date.setMonth normalizes overflow (Jan 31 + 1 month = Mar 3),
 * which would silently shift vest boundaries for month-end start dates.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, lastDay));
  return result;
}

export interface VestSchedule {
  start: Date;
  vestYears: number;
  cliffMonths: number;
}

/**
 * Fraction of the TOTAL grant vested at instant `t`, for a grant vesting
 * linearly over vestYears with an optional cliff. Nothing is vested before the
 * cliff; at the cliff the accrued amount vests at once (a 12-month cliff on a
 * 4-year grant pays 25% that day), then vesting continues linearly.
 */
export function vestedFractionAt(t: number | Date, schedule: VestSchedule): number {
  const time = typeof t === "number" ? t : t.getTime();
  const totalMonths = Math.round(schedule.vestYears * 12);
  if (totalMonths <= 0) return 0;
  const startMs = schedule.start.getTime();
  const endMs = addMonthsClamped(schedule.start, totalMonths).getTime();
  // Clamp the cliff to the vest window: the API rejects longer cliffs, but a
  // stored bad value must not model a grant that pays after it has ended.
  const cliffMs = addMonthsClamped(
    schedule.start,
    Math.min(Math.max(0, schedule.cliffMonths), totalMonths)
  ).getTime();
  if (time < cliffMs || time <= startMs) return 0;
  if (time >= endMs) return 1;
  return (time - startMs) / (endMs - startMs);
}

/**
 * Fraction of the total grant that vests within [from, to). vestedFractionAt
 * counts a vest event at its own instant, so both ends are read one
 * millisecond early: an event exactly at `from` is inside the window and one
 * exactly at `to` (a cliff at midnight on Jan 1) belongs to the next window.
 */
export function grantFractionVestedBetween(
  from: number | Date,
  to: number | Date,
  schedule: VestSchedule
): number {
  return Math.max(
    0,
    vestedFractionAt(justBefore(to), schedule) - vestedFractionAt(justBefore(from), schedule)
  );
}

function justBefore(t: number | Date): number {
  return (typeof t === "number" ? t : t.getTime()) - 1;
}

/**
 * Fraction of the TOTAL grant received during calendar year `year`. Computed as
 * vested(year end) - vested(year start), so the cliff year correctly gets the
 * lump plus its remaining months.
 */
export function grantFractionReceivedInYear(
  year: number,
  start: Date,
  vestYears: number,
  cliffMonths: number
): number {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  return grantFractionVestedBetween(yearStart, yearEnd, { start, vestYears, cliffMonths });
}

/** Parse a YYYY-MM-DD string as a local-time midnight. */
export function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

/** The vesting schedule an entry describes, or null when it has no vest length. */
export function scheduleFor(entry: CompEntry): VestSchedule | null {
  const vestYears = entry.vest_years ? Number(entry.vest_years) : 0;
  if (!(vestYears > 0)) return null;
  return {
    start: parseLocalDate(entry.vest_start ?? entry.effective_date),
    vestYears,
    cliffMonths: entry.vest_cliff_months ? Number(entry.vest_cliff_months) : 0,
  };
}

/** Whether the entry models its equity as a share count. */
export function hasShares(entry: CompEntry): boolean {
  return Number(entry.shares) > 0;
}

/**
 * The per-share price the recorded equity implies, when the entry has both a
 * share count and a flat equity amount. Null otherwise: the tracker never
 * invents a price.
 */
export function impliedSharePrice(entry: CompEntry): number | null {
  const shares = Number(entry.shares);
  const equity = Number(entry.equity);
  if (!(shares > 0) || !(equity > 0)) return null;
  return equity / shares;
}

/**
 * Pick the share price the projection anchors on: the live quote when there is
 * one, else the price the recorded equity implies, else null (unknown). An
 * entry without shares has no share price at all.
 */
export function anchorSharePrice(entry: CompEntry, quote: StockQuote | null): number | null {
  if (!hasShares(entry)) return null;
  if (quote && Number.isFinite(quote.price) && quote.price > 0) return quote.price;
  return impliedSharePrice(entry);
}

/**
 * Value of the whole grant the entry describes. Shares at the given price when
 * the entry is share-based (0 when the price is unknown), else the flat equity
 * amount.
 */
export function grantValue(entry: CompEntry, sharePrice: number | null): number {
  if (hasShares(entry)) {
    return sharePrice && sharePrice > 0 ? Number(entry.shares) * sharePrice : 0;
  }
  return Number(entry.equity);
}

export interface ProjectionYear {
  year: number;
  salary: number;
  incentives: number;
  /** Stock received in the year that has already vested as of the projection date. */
  stockVested: number;
  /** Stock received in the year that is still to vest as of the projection date. */
  stockUnvested: number;
  stock: number;
  total: number;
}

export interface Projection {
  years: ProjectionYear[];
  hasVestSchedule: boolean;
  grantValue: number;
}

/**
 * Multi-year projection. Salary and incentives are carried flat. Stock is the
 * grant value spread across the vesting window when the entry has one, split
 * into what has vested by `asOf` and what has not; without a schedule the
 * grant value is carried flat each year and counted as unvested-agnostic
 * "stock" (all of it in stockVested, since nothing says otherwise).
 */
export function projectComp(
  entry: CompEntry,
  options: { sharePrice: number | null; years: number[]; asOf: Date }
): Projection {
  const schedule = scheduleFor(entry);
  const grant = grantValue(entry, options.sharePrice);
  const salary = Number(entry.base);
  const incentives = Number(entry.bonus);
  const asOfMs = options.asOf.getTime();

  const years = options.years.map((year) => {
    let stockVested: number;
    let stockUnvested: number;
    if (schedule) {
      const yearStart = new Date(year, 0, 1).getTime();
      const yearEnd = new Date(year + 1, 0, 1).getTime();
      const received = grantFractionVestedBetween(yearStart, yearEnd, schedule);
      // A vest event at the asOf instant itself has vested, as in vestSummary.
      const vestedByNow =
        asOfMs < yearStart
          ? 0
          : grantFractionVestedBetween(yearStart, Math.min(yearEnd, asOfMs + 1), schedule);
      stockVested = grant * vestedByNow;
      stockUnvested = grant * Math.max(0, received - vestedByNow);
    } else {
      stockVested = grant;
      stockUnvested = 0;
    }
    const stock = stockVested + stockUnvested;
    return {
      year,
      salary,
      incentives,
      stockVested,
      stockUnvested,
      stock,
      total: salary + incentives + stock,
    };
  });

  return { years, hasVestSchedule: schedule !== null, grantValue: grant };
}

export interface VestSummary {
  grantValue: number;
  vestedFraction: number;
  vestedValue: number;
  unvestedValue: number;
  cliffDate: Date | null;
  cliffPassed: boolean;
  /** Value that vests all at once on the cliff date (0 without a cliff). */
  cliffValue: number;
  fullyVestedDate: Date;
  fullyVested: boolean;
}

/** Where the grant stands today: how much has vested, what's left, and when it ends. */
export function vestSummary(
  entry: CompEntry,
  sharePrice: number | null,
  asOf: Date
): VestSummary | null {
  const schedule = scheduleFor(entry);
  if (!schedule) return null;
  const grant = grantValue(entry, sharePrice);
  const fraction = vestedFractionAt(asOf, schedule);
  const totalMonths = Math.round(schedule.vestYears * 12);
  const cliffDate =
    schedule.cliffMonths > 0
      ? addMonthsClamped(schedule.start, Math.min(schedule.cliffMonths, totalMonths))
      : null;
  const fullyVestedDate = addMonthsClamped(schedule.start, totalMonths);
  return {
    grantValue: grant,
    vestedFraction: fraction,
    vestedValue: grant * fraction,
    unvestedValue: grant * (1 - fraction),
    cliffDate,
    cliffPassed: cliffDate ? asOf.getTime() >= cliffDate.getTime() : true,
    cliffValue: cliffDate ? grant * vestedFractionAt(cliffDate, schedule) : 0,
    fullyVestedDate,
    fullyVested: fraction >= 1,
  };
}

/** Total comp an entry records: base + bonus + flat equity. */
export function entryTotal(entry: CompEntry): number {
  return Number(entry.base) + Number(entry.bonus) + Number(entry.equity);
}

/**
 * Total comp for one year at a given share price: base + bonus + the year's
 * stock. Without a vest schedule that is the whole grant; with one it is the
 * slice the current year receives.
 */
export function scenarioTotal(entry: CompEntry, sharePrice: number | null, asOf: Date): number {
  const projection = projectComp(entry, {
    sharePrice,
    years: [asOf.getFullYear()],
    asOf,
  });
  return projection.years[0].total;
}

/** Full-precision USD, no cents. */
export function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** USD with cents, for share prices. */
export function formatPrice(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Compact USD for tables and chart labels: $950, $46.5K, $155K, $1.2M, $88B.
 * One decimal below $100K (where it still changes the reading), none above.
 */
export function formatCompactUsd(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const trim = (v: number, digits: number) =>
    v.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9, 1)}B`;
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6, 2)}M`;
  if (abs >= 1e5) return `${sign}$${Math.round(abs / 1e3)}K`;
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3, 1)}K`;
  return `${sign}$${Math.round(abs)}`;
}

/** Signed percent for deltas: +8.7%, -29.6%. */
export function formatSignedPct(pct: number, digits = 1): string {
  const rounded = Number(pct.toFixed(digits));
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toFixed(digits)}%`;
}

/** Signed currency for deltas: +$28.07, -$104. */
export function formatSignedUsd(n: number, withCents = false): string {
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${withCents ? formatPrice(Math.abs(n)) : formatUsd(Math.abs(n))}`;
}

/**
 * Round a chart's top value up to a clean tick step and return the ticks.
 * Steps are 1, 2, 2.5 or 5 times a power of ten, so axis labels read as round
 * numbers ($100K, $200K) instead of the data's own maximum.
 */
export function niceTicks(max: number, targetCount = 4): number[] {
  if (!(max > 0)) return [0];
  const rough = max / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * magnitude);
  const step = candidates.find((c) => c >= rough) ?? candidates[candidates.length - 1];
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return ticks;
}

/**
 * The headline number: annual total comp. Base + bonus + equity per year,
 * where a vesting grant is spread evenly over its vest length (the way offer
 * letters and market ranges quote it) and a flat grant counts as-is.
 */
export function annualizedTotal(entry: CompEntry, sharePrice: number | null): number {
  const schedule = scheduleFor(entry);
  const grant = grantValue(entry, sharePrice);
  const equityPerYear = schedule ? grant / schedule.vestYears : grant;
  return Number(entry.base) + Number(entry.bonus) + equityPerYear;
}

export interface AnnualBreakdown {
  salary: number;
  incentives: number;
  equityPerYear: number;
  total: number;
}

/** The headline number split into its three parts. */
export function annualBreakdown(entry: CompEntry, sharePrice: number | null): AnnualBreakdown {
  const salary = Number(entry.base);
  const incentives = Number(entry.bonus);
  const total = annualizedTotal(entry, sharePrice);
  return { salary, incentives, equityPerYear: total - salary - incentives, total };
}
