/**
 * One validation contract for a comp entry, shared by the entry form, the
 * guest cache, the REST API and the MCP tools (through comp-service). Whatever
 * the form accepts, the API accepts, so an entry a guest saved before signing
 * up never comes back as a 400 when the account imports it.
 *
 * Client-safe: no server imports. The field parsers are exported so the
 * server's edit path can apply the same rules to a partial patch.
 */

import type { CompEntryInput } from "@/types";
import { COMP_LIMITS, VEST_YEARS_MIN_LABEL } from "@/lib/constants/careerotter";
import { MONTHS_PER_YEAR } from "@/lib/constants/dates";
import {
  codePointLength,
  hasNulCharacter,
  isCalendarDate,
  isPlainObject,
  truncateCodePoints,
} from "@/lib/careerotter/field-guards";
import { normalizeTicker, TICKER_PATTERN } from "@/lib/careerotter/tickers";

function formatLimit(value: number, scale: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: scale,
    maximumFractionDigits: scale,
  }).format(value);
}

const AMOUNT_MAX_LABEL = formatLimit(COMP_LIMITS.amountMax, COMP_LIMITS.amountScale);
const SHARES_MAX_LABEL = formatLimit(COMP_LIMITS.sharesMax, COMP_LIMITS.sharesScale);

export const COMP_ENTRY_MESSAGES = {
  notObject: "Invalid entry",
  effectiveDate: "effective_date must be a valid YYYY-MM-DD date",
  amountType: (field: string): string => `${field} must be a non-negative number`,
  amountTooLarge: (field: string): string =>
    `${field} must be no larger than ${AMOUNT_MAX_LABEL}`,
  ticker: `ticker must be 1-${COMP_LIMITS.tickerMax} letters, digits, dots or hyphens`,
  shares: `shares must be a non-negative number no larger than ${SHARES_MAX_LABEL}`,
  noteNul: "note must not contain null characters",
  noteTooLong: `note must be ${COMP_LIMITS.noteMax} characters or fewer`,
  vestStart: "vest_start must be a valid YYYY-MM-DD date",
  vestYears: `vest_years must be at least ${COMP_LIMITS.vestYearsMin} (${VEST_YEARS_MIN_LABEL}) and at most ${COMP_LIMITS.vestYearsMax}`,
  vestCliff: `vest_cliff_months must be a whole number between 0 and ${COMP_LIMITS.vestCliffMonthsMax}`,
  cliffNeedsVest: "vest_cliff_months requires vest_years",
  cliffTooLong: "vest_cliff_months cannot exceed the vesting duration",
} as const;

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

function pass<T>(value: T): FieldResult<T> {
  return { ok: true, value };
}

function fail<T>(error: string): FieldResult<T> {
  return { ok: false, error };
}

/** A finite, non-negative number, else null. */
function nonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Absent, in the sense a new entry treats as "not provided". */
function absent(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

// ── field parsers ──────────────────────────────────────────────────────────
// Each takes a value the caller has already decided is present and applies
// the field's rule with no coercion.

export function parseEffectiveDate(raw: unknown): FieldResult<string> {
  return isCalendarDate(raw) ? pass(raw) : fail(COMP_ENTRY_MESSAGES.effectiveDate);
}

/** A non-negative amount that fits numeric(12,2). */
export function parseAmount(field: string, raw: unknown): FieldResult<number> {
  const amount = nonNegative(raw);
  if (amount === null) return fail(COMP_ENTRY_MESSAGES.amountType(field));
  if (amount > COMP_LIMITS.amountMax) return fail(COMP_ENTRY_MESSAGES.amountTooLarge(field));
  return pass(amount);
}

/**
 * A trimmed note, null when blank. With `truncate`, an over-long note is cut
 * to the cap by code point (never splitting a surrogate pair); without it, an
 * over-long note is rejected.
 */
export function parseNote(value: string, truncate: boolean): FieldResult<string | null> {
  if (hasNulCharacter(value)) return fail(COMP_ENTRY_MESSAGES.noteNul);
  const note = value.trim();
  if (!truncate && codePointLength(note) > COMP_LIMITS.noteMax) {
    return fail(COMP_ENTRY_MESSAGES.noteTooLong);
  }
  return pass(truncateCodePoints(note, COMP_LIMITS.noteMax) || null);
}

/**
 * A trimmed, uppercased ticker, null when blank. Over-long tickers are
 * rejected rather than truncated: a truncated symbol names a different
 * security.
 */
export function parseTicker(value: string): FieldResult<string | null> {
  const ticker = normalizeTicker(value);
  if (ticker === "") return pass(null);
  return TICKER_PATTERN.test(ticker) ? pass(ticker) : fail(COMP_ENTRY_MESSAGES.ticker);
}

/** A storable share count: numeric(14,4) tops out at 9,999,999,999.9999. */
export function parseShares(raw: unknown): FieldResult<number> {
  const shares = nonNegative(raw);
  if (shares === null || shares > COMP_LIMITS.sharesMax) return fail(COMP_ENTRY_MESSAGES.shares);
  return pass(shares);
}

export function parseVestStart(raw: unknown): FieldResult<string> {
  return isCalendarDate(raw) ? pass(raw) : fail(COMP_ENTRY_MESSAGES.vestStart);
}

/** At least one month (so projections see a vest that pays) and at most vestYearsMax. */
export function parseVestYears(raw: unknown): FieldResult<number> {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fail(COMP_ENTRY_MESSAGES.vestYears);
  if (raw < COMP_LIMITS.vestYearsMin || raw > COMP_LIMITS.vestYearsMax) {
    return fail(COMP_ENTRY_MESSAGES.vestYears);
  }
  return pass(raw);
}

export function parseVestCliff(raw: unknown): FieldResult<number> {
  if (typeof raw !== "number" || !Number.isInteger(raw)) return fail(COMP_ENTRY_MESSAGES.vestCliff);
  if (raw < 0 || raw > COMP_LIMITS.vestCliffMonthsMax) return fail(COMP_ENTRY_MESSAGES.vestCliff);
  return pass(raw);
}

/**
 * A cliff only means something relative to a vest schedule: without a
 * duration the projection would silently ignore it, and a cliff longer than
 * the vest describes a schedule that never pays until after it ends.
 */
export function checkCliffFitsVest(
  cliffMonths: number | null,
  vestYears: number | null
): FieldResult<null> {
  if (cliffMonths === null || cliffMonths === 0) return pass(null);
  if (vestYears === null) return fail(COMP_ENTRY_MESSAGES.cliffNeedsVest);
  if (cliffMonths > Math.round(vestYears * MONTHS_PER_YEAR)) {
    return fail(COMP_ENTRY_MESSAGES.cliffTooLong);
  }
  return pass(null);
}

// ── whole entry ────────────────────────────────────────────────────────────

/** Optional on a new entry: absent is null, anything else must pass `parse`. */
function optional<T>(raw: unknown, parse: (raw: unknown) => FieldResult<T>): FieldResult<T | null> {
  return absent(raw) ? pass(null) : parse(raw);
}

/**
 * bonus and equity are optional: anything that is not a non-negative number
 * is stored as 0, but a real number too large for the column is an error
 * rather than silently zeroed.
 */
function lenientAmount(field: string, raw: unknown): FieldResult<number> {
  return nonNegative(raw) === null ? pass(0) : parseAmount(field, raw);
}

export type CompEntryValidation =
  | { ok: true; value: CompEntryInput; note: string | null }
  | { ok: false; error: string };

/**
 * Validate and normalize a new entry. On success the value is exactly what
 * the API stores: trimmed uppercase ticker, defaults applied, and every
 * optional field either a valid value or null. Invalid optional values are
 * rejected, not dropped, so a typo never silently becomes "no shares" or "no
 * vesting".
 */
export function validateCompEntryInput(body: unknown): CompEntryValidation {
  if (!isPlainObject(body)) return { ok: false, error: COMP_ENTRY_MESSAGES.notObject };

  const effectiveDate = parseEffectiveDate(body.effective_date);
  if (!effectiveDate.ok) return effectiveDate;
  const base = parseAmount("base", body.base);
  if (!base.ok) return base;
  const bonus = lenientAmount("bonus", body.bonus);
  if (!bonus.ok) return bonus;
  const equity = lenientAmount("equity", body.equity);
  if (!equity.ok) return equity;
  const note = typeof body.note === "string" ? parseNote(body.note, true) : pass(null);
  if (!note.ok) return note;
  const ticker = typeof body.ticker === "string" ? parseTicker(body.ticker) : pass(null);
  if (!ticker.ok) return ticker;
  const shares = optional(body.shares, parseShares);
  if (!shares.ok) return shares;
  const vestStart = optional(body.vest_start, parseVestStart);
  if (!vestStart.ok) return vestStart;
  const vestYears = optional(body.vest_years, parseVestYears);
  if (!vestYears.ok) return vestYears;
  const vestCliff = optional(body.vest_cliff_months, parseVestCliff);
  if (!vestCliff.ok) return vestCliff;
  const fits = checkCliffFitsVest(vestCliff.value, vestYears.value);
  if (!fits.ok) return fits;

  return {
    ok: true,
    note: note.value,
    value: {
      effective_date: effectiveDate.value,
      base: base.value,
      bonus: bonus.value,
      equity: equity.value,
      ticker: ticker.value,
      shares: shares.value,
      vest_start: vestStart.value,
      vest_years: vestYears.value,
      vest_cliff_months: vestCliff.value,
    },
  };
}
