/**
 * Year in Review is seasonal: every surface 404s until YEAR_IN_REVIEW_ENABLED=1,
 * the same launch-gate pattern as CAREEROTTER_ENABLED.
 */
export function isYearInReviewEnabled(): boolean {
  return process.env.YEAR_IN_REVIEW_ENABLED === "1";
}

const PAGE_ROUTES = ["/dashboard/year-in-review", "/year-in-review"];

/** Matched on segment boundaries so /year-in-reviewer could never be caught. */
export function isYearInReviewSurface(pathname: string): boolean {
  if (PAGE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) return true;
  return pathname === "/api/year-in-review" || pathname.startsWith("/api/year-in-review/");
}
