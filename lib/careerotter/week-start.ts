/**
 * The ISO week boundary the weekly recap is keyed to.
 *
 * weekly_recaps.week_start has a CHECK that it's a Monday, and the recap cron
 * upserts against it — so "which week is this?" has to mean exactly the same
 * thing in the cron, in Today's "logged since Monday" count, and in the card
 * that decides whether a stored recap is the current week's.
 */

/** Monday 00:00 UTC of the week containing `now`, as YYYY-MM-DD. */
export function weekStartOf(now: Date): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  // getUTCDay is 0 for Sunday, so shift the week to start on Monday.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** Epoch ms of Monday 00:00 UTC of the week containing `now`. */
export function weekStartMs(now: Date): number {
  return new Date(`${weekStartOf(now)}T00:00:00Z`).getTime();
}
