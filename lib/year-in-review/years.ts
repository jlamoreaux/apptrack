/** First year the product existed; earlier years have no data to review. */
export const FIRST_REVIEW_YEAR = 2024;

export function isReviewableYear(year: number, now: Date): boolean {
  return Number.isInteger(year) && year >= FIRST_REVIEW_YEAR && year <= now.getUTCFullYear();
}

/** In January the year worth reviewing is the one that just ended. */
export function defaultReviewYear(now: Date): number {
  return now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}
