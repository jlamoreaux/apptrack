/**
 * The job-search strip on Today shows counts, not the applications themselves —
 * the tracker owns that. Summarizing on the server also keeps job descriptions
 * and notes out of the client bundle.
 */

export interface JobSearchSummary {
  total: number;
  /** Interview Scheduled + Interviewed. */
  interviewing: number;
  offers: number;
  /** Anything still live: not Rejected, not Hired. */
  active: number;
}

export function summarizeJobSearch(
  applications: ReadonlyArray<{ status?: string | null }>
): JobSearchSummary {
  let interviewing = 0;
  let offers = 0;
  let active = 0;

  for (const app of applications) {
    const status = app.status ?? "Applied";
    if (status === "Interview Scheduled" || status === "Interviewed") interviewing += 1;
    if (status === "Offer") offers += 1;
    if (status !== "Rejected" && status !== "Hired") active += 1;
  }

  return { total: applications.length, interviewing, offers, active };
}
