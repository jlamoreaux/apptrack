/**
 * The counts behind Today's job-search strip. "Active" is what the next-move
 * engine reads to decide whether a job seeker has a pipeline at all, so a
 * miscount there changes what the page asks for.
 */

// @jest-environment node

import { summarizeJobSearch } from "@/lib/careerotter/job-search-summary";

describe("summarizeJobSearch", () => {
  it("is all zeroes for an empty list", () => {
    expect(summarizeJobSearch([])).toEqual({
      total: 0,
      interviewing: 0,
      offers: 0,
      active: 0,
    });
  });

  it("counts both interview stages as interviewing", () => {
    const summary = summarizeJobSearch([
      { status: "Interview Scheduled" },
      { status: "Interviewed" },
      { status: "Applied" },
    ]);
    expect(summary.interviewing).toBe(2);
    expect(summary.total).toBe(3);
  });

  it("treats rejected and hired as no longer active", () => {
    const summary = summarizeJobSearch([
      { status: "Applied" },
      { status: "Offer" },
      { status: "Rejected" },
      { status: "Hired" },
    ]);
    expect(summary.total).toBe(4);
    expect(summary.active).toBe(2);
    expect(summary.offers).toBe(1);
  });

  it("treats a missing status as Applied, matching the column default", () => {
    const summary = summarizeJobSearch([{ status: null }, {}]);
    expect(summary.active).toBe(2);
    expect(summary.interviewing).toBe(0);
  });
});
