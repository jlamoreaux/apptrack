/**
 * Review countdown — a standing deadline without a crisis (RFC §6). Pure so it's
 * testable and shared between the display component and any server rendering.
 */

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ReviewCountdown {
  weeks: number;
  days: number;
  isPast: boolean;
  label: string;
}

/**
 * Weeks/days from `now` to the review date. `reviewDate` is a YYYY-MM-DD string
 * (as stored). Returns null if there's no date set.
 */
export function reviewCountdown(
  reviewDate: string | null | undefined,
  now: Date
): ReviewCountdown | null {
  if (!reviewDate) return null;
  const target = new Date(`${reviewDate}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;

  const diffMs = target.getTime() - now.getTime();
  const isPast = diffMs < 0;
  const absDays = Math.ceil(Math.abs(diffMs) / MS_PER_DAY);
  const weeks = Math.floor(Math.abs(diffMs) / MS_PER_WEEK);

  let label: string;
  if (isPast) {
    label = "Review date passed";
  } else if (absDays <= 7) {
    label = absDays <= 1 ? "Review is tomorrow" : `Review in ${absDays} days`;
  } else {
    label = `Review in ${weeks} week${weeks === 1 ? "" : "s"}`;
  }

  return { weeks, days: absDays, isPast, label };
}
