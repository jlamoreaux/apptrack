/**
 * Review countdown — a standing deadline without a crisis (RFC §6). Pure so it's
 * testable and shared between the display component and any server rendering.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ReviewCountdown {
  weeks: number;
  days: number;
  isPast: boolean;
  label: string;
}

export interface ReviewCountdownOptions {
  /**
   * The noun the label leads with. "Review" by default; job-search mode is
   * working toward a target date, not a performance review.
   */
  noun?: string;
}

/**
 * Whole days from the calendar day containing `now` to the review date.
 *
 * Both sides are normalized to a midnight, which is what makes "has my review
 * date passed?" a question about calendar days rather than instants. Comparing
 * raw timestamps told a UTC-7 user their review had passed from 17:01 the
 * evening before, because the stored date parses to UTC midnight.
 */
function wholeDaysUntil(reviewDate: string, now: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(reviewDate);
  if (!match) return null;
  const [, y, m, d] = match;
  const target = Date.UTC(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(target)) return null;

  // `now`'s own calendar date, in the viewer's zone, pinned to UTC midnight so
  // the subtraction is a whole number of days.
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((target - today) / MS_PER_DAY);
}

/**
 * Weeks/days from `now` to the review date. `reviewDate` is a YYYY-MM-DD string
 * (as stored). Returns null if there's no date set.
 */
export function reviewCountdown(
  reviewDate: string | null | undefined,
  now: Date,
  options: ReviewCountdownOptions = {}
): ReviewCountdown | null {
  if (!reviewDate) return null;

  const diffDays = wholeDaysUntil(reviewDate, now);
  if (diffDays === null) return null;

  // The review day itself is not "past" — it's today.
  const isPast = diffDays < 0;
  const absDays = Math.abs(diffDays);
  const weeks = Math.floor(absDays / 7);

  const noun = options.noun ?? "Review";

  let label: string;
  if (isPast) {
    label = `${noun} date passed`;
  } else if (absDays === 0) {
    label = `${noun} is today`;
  } else if (absDays === 1) {
    label = `${noun} is tomorrow`;
  } else if (absDays <= 7) {
    label = `${noun} in ${absDays} days`;
  } else {
    label = `${noun} in ${weeks} week${weeks === 1 ? "" : "s"}`;
  }

  return { weeks, days: absDays, isPast, label };
}
