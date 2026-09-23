/**
 * Calendar-date constants shared by date validation and date arithmetic.
 */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A date in YYYY-MM-DD form; whether it names a real day is checked separately. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_DATE_LENGTH = "YYYY-MM-DD".length;

// Postgres has no year 0, so a 0000 date would pass the pattern yet fail at
// insert time.
export const ISO_DATE_MIN = "0001-01-01";

// Hour used when building a local-time Date for a calendar day: some zones
// skip midnight on a DST change, while midday exists on every day.
export const MIDDAY_HOUR = 12;
