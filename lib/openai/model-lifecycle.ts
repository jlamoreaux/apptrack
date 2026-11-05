/** How far ahead of a shutdown the weekly check starts failing, long enough to test and ship a migration. */
export const SHUTDOWN_WARNING_DAYS = 90;

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ShutdownAssessment {
  model: string;
  shutdownDate: string | null;
  daysLeft: number | null;
  /** Why this model needs attention; null when it is safe for now. */
  problem: string | null;
}

/**
 * Judge a model from the `shutdown_date` the OpenAI models API returns (YYYY-MM-DD, or
 * null/absent when none is announced). An unreadable date counts as a problem, so a
 * format change in the API surfaces instead of reading as "no shutdown planned".
 */
export function assessModelShutdown(
  model: string,
  shutdownDate: unknown,
  now: Date = new Date()
): ShutdownAssessment {
  if (shutdownDate === null || shutdownDate === undefined) {
    return { model, shutdownDate: null, daysLeft: null, problem: null };
  }

  const timestamp =
    typeof shutdownDate === "string" && ISO_DATE.test(shutdownDate)
      ? Date.parse(`${shutdownDate}T00:00:00Z`)
      : Number.NaN;

  if (typeof shutdownDate !== "string" || Number.isNaN(timestamp)) {
    return {
      model,
      shutdownDate: String(shutdownDate),
      daysLeft: null,
      problem: `unreadable shutdown_date: ${JSON.stringify(shutdownDate)}`,
    };
  }

  const daysLeft = Math.ceil((timestamp - now.getTime()) / MS_PER_DAY);
  const problem =
    daysLeft <= SHUTDOWN_WARNING_DAYS
      ? `shuts down on ${shutdownDate} (${daysLeft} days left, limit ${SHUTDOWN_WARNING_DAYS})`
      : null;

  return { model, shutdownDate, daysLeft, problem };
}
