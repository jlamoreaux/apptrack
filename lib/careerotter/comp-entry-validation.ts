/**
 * One validation contract for a comp entry, shared by the entry form, the
 * guest cache and the POST route. Whatever the form accepts, the API accepts,
 * so an entry a guest saved before signing up never comes back as a 400 when
 * the account imports it.
 */

import type { CompEntryInput } from "@/types";
import { COMP_ENTRY_LIMITS } from "@/lib/constants/careerotter";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True only for a real calendar date in YYYY-MM-DD form. The regex alone
 * accepts impossible dates like 2026-02-29, which would then fail at insert
 * time as a 500 instead of a validation 400.
 */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** A finite, non-negative number, else null. */
function nonNegative(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

/** Absent, in the sense the API treats as "not provided". */
const absent = (v: unknown): boolean => v === undefined || v === null || v === "";

export type CompEntryValidation =
  | { ok: true; value: CompEntryInput; note: string | null }
  | { ok: false; error: string };

/**
 * Validate and normalize an entry body. On success the value is exactly what
 * the API stores: trimmed uppercase ticker, defaults applied, and every
 * optional field either a valid value or null.
 */
export function validateCompEntryInput(body: unknown): CompEntryValidation {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid entry" };
  }
  const b = body as Record<string, unknown>;

  if (!isIsoDate(b.effective_date)) {
    return { ok: false, error: "effective_date must be a valid YYYY-MM-DD date" };
  }
  const base = nonNegative(b.base);
  if (base === null) {
    return { ok: false, error: "base must be a non-negative number" };
  }
  const bonus = nonNegative(b.bonus) ?? 0;
  const equity = nonNegative(b.equity) ?? 0;
  const note =
    typeof b.note === "string" ? b.note.trim().slice(0, COMP_ENTRY_LIMITS.noteMax) || null : null;
  const ticker =
    typeof b.ticker === "string"
      ? b.ticker.trim().toUpperCase().slice(0, COMP_ENTRY_LIMITS.tickerMax) || null
      : null;

  // shares is optional, but if supplied it must be a storable non-negative
  // number: numeric(14,4) tops out at 9,999,999,999.9999. Rejected rather than
  // silently dropped, so a typo does not become "no shares".
  let shares: number | null = null;
  if (!absent(b.shares)) {
    if (
      typeof b.shares !== "number" ||
      !Number.isFinite(b.shares) ||
      b.shares < 0 ||
      b.shares > COMP_ENTRY_LIMITS.sharesMax
    ) {
      return {
        ok: false,
        error: "shares must be a non-negative number no larger than 9,999,999,999.9999",
      };
    }
    shares = b.shares;
  }

  // Optional vesting schedule. vest_years is bounded to a sane grant length;
  // vest_start must be a plain date. Invalid values are rejected, not dropped.
  let vestStart: string | null = null;
  if (!absent(b.vest_start)) {
    if (!isIsoDate(b.vest_start)) {
      return { ok: false, error: "vest_start must be a valid YYYY-MM-DD date" };
    }
    vestStart = b.vest_start;
  }
  let vestYears: number | null = null;
  if (!absent(b.vest_years)) {
    if (
      typeof b.vest_years !== "number" ||
      !Number.isFinite(b.vest_years) ||
      b.vest_years <= 0 ||
      b.vest_years > COMP_ENTRY_LIMITS.vestYearsMax
    ) {
      return { ok: false, error: "vest_years must be a number between 0 and 10" };
    }
    vestYears = b.vest_years;
  }
  let vestCliffMonths: number | null = null;
  if (!absent(b.vest_cliff_months)) {
    if (
      typeof b.vest_cliff_months !== "number" ||
      !Number.isInteger(b.vest_cliff_months) ||
      b.vest_cliff_months < 0 ||
      b.vest_cliff_months > COMP_ENTRY_LIMITS.cliffMonthsMax
    ) {
      return { ok: false, error: "vest_cliff_months must be a whole number between 0 and 60" };
    }
    vestCliffMonths = b.vest_cliff_months;
  }
  // A cliff only means something relative to a vest schedule: without a
  // duration the projection would silently ignore it, and a cliff longer
  // than the vest describes a schedule that never pays until after it ends.
  if (vestCliffMonths !== null && vestCliffMonths > 0) {
    if (vestYears === null) {
      return { ok: false, error: "vest_cliff_months requires vest_years" };
    }
    if (vestCliffMonths > Math.round(vestYears * 12)) {
      return { ok: false, error: "vest_cliff_months cannot exceed the vesting duration" };
    }
  }

  return {
    ok: true,
    note,
    value: {
      effective_date: b.effective_date,
      base,
      bonus,
      equity,
      ticker,
      shares,
      vest_start: vestStart,
      vest_years: vestYears,
      vest_cliff_months: vestCliffMonths,
    },
  };
}
