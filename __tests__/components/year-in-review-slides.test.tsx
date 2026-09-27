import { buildSlides, stillInItLine } from "@/components/year-in-review/slides";
import { computeYearInReview } from "@/lib/year-in-review/compute";
import { EMPTY_ACTIVITY, type ReviewApplication } from "@/lib/year-in-review/types";

const ASOF = new Date("2026-12-05T00:00:00Z");

function apps(count: number, overrides: Partial<ReviewApplication> = {}): ReviewApplication[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i),
    company: `Company ${i}`,
    role: "Product Designer",
    status: "Rejected",
    date_applied: `2026-0${1 + (i % 9)}-1${i % 9}`,
    ...overrides,
  }));
}

function ids(applications: ReviewApplication[], activity = EMPTY_ACTIVITY) {
  const stats = computeYearInReview({ year: 2026, asOf: ASOF, applications, history: [], activity });
  return buildSlides(stats).map((s) => s.id);
}

describe("buildSlides", () => {
  it("leaves out cards with nothing to say", () => {
    const result = ids(apps(1));
    expect(result).toEqual(["intro", "volume", "roles", "funnel", "outcome"]);
  });

  it("adds the silence card only when something is still waiting", () => {
    expect(ids(apps(6))).not.toContain("silence");
    expect(ids(apps(6, { status: "Applied" }))).toContain("silence");
  });

  it("adds the label and work cards when earned", () => {
    const result = ids(apps(6), { ...EMPTY_ACTIVITY, coverLetters: 4 });
    expect(result).toContain("work");
    expect(result).toContain("label");
  });

  it("gives every card a unique id", () => {
    const result = ids(apps(12, { status: "Applied" }), { ...EMPTY_ACTIVITY, fitAnalyses: 2 });
    expect(new Set(result).size).toBe(result.length);
  });
});

describe("stillInItLine", () => {
  function stats(applications: ReviewApplication[]) {
    return computeYearInReview({ year: 2026, asOf: ASOF, applications, history: [], activity: EMPTY_ACTIVITY });
  }

  it("leads with interviews when there were any", () => {
    expect(stillInItLine(stats(apps(3, { status: "Interviewed" })))).toBe(
      "3 interviews this year. Every one is practice the next one gets to use."
    );
  });

  it("falls back to applications", () => {
    expect(stillInItLine(stats(apps(4)))).toBe("4 applications this year. Every one made the next one sharper.");
  });

  it("has its own wording for a single interview or application", () => {
    expect(stillInItLine(stats(apps(1, { status: "Interviewed" })))).toBe(
      "1 interview this year. That practice carries into the next one."
    );
    expect(stillInItLine(stats(apps(1)))).toBe("Your first application is logged. Next year builds on it.");
  });
});
