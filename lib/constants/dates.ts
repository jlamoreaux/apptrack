/**
 * Calendar-date constants shared by date validation and date arithmetic.
 */

export const MS_PER_SECOND = 1000;
export const MS_PER_DAY = 24 * 60 * 60 * MS_PER_SECOND;
export const MONTHS_PER_YEAR = 12;

/** A date in YYYY-MM-DD form; whether it names a real day is checked separately. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_DATE_FORMAT = "YYYY-MM-DD";
export const ISO_DATE_LENGTH = ISO_DATE_FORMAT.length;

// Postgres has no year 0, so a 0000 date would pass the pattern yet fail at
// insert time.
export const ISO_DATE_MIN = "0001-01-01";
