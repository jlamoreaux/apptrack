/**
 * @jest-environment node
 */
import {
  computeYearInReview,
  dedupeHistory,
  normalizeRole,
  MIN_RESPONSE_SAMPLES,
} from "@/lib/year-in-review/compute";
import { assignLabel, peakWindowShare, LABEL_THRESHOLDS, type LabelInput } from "@/lib/year-in-review/labels";
import {
  buildSharePayload,
  decodeShareToken,
  encodeShareToken,
} from "@/lib/year-in-review/share-token";
import {
  EMPTY_ACTIVITY,
  type ReviewApplication,
  type ReviewHistoryRow,
} from "@/lib/year-in-review/types";

const ASOF = new Date("2026-12-05T12:00:00Z");

function app(overrides: Partial<ReviewApplication> & { id: string }): ReviewApplication {
  return {
    company: "Acme",
    role: "Product Designer",
    status: "Applied",
    date_applied: "2026-03-02",
    archived: false,
    ...overrides,
  };
}

function row(application_id: string, new_status: string, changed_at: string, old_status: string | null = "Applied"): ReviewHistoryRow {
  return { application_id, old_status, new_status, changed_at };
}

function compute(applications: ReviewApplication[], history: ReviewHistoryRow[] = [], activity = EMPTY_ACTIVITY) {
  return computeYearInReview({ year: 2026, asOf: ASOF, applications, history, activity });
}

describe("normalizeRole", () => {
  it("strips seniority and punctuation so variants of one job match", () => {
    expect(normalizeRole("Senior Product Designer")).toBe("product designer");
    expect(normalizeRole("Product Designer II")).toBe("product designer");
    expect(normalizeRole("Sr. Product-Designer")).toBe("product designer");
  });

  it("keeps language names that use symbols", () => {
    expect(normalizeRole("C# Engineer")).toBe("c# engineer");
  });
});

describe("dedupeHistory", () => {
  it("collapses the same transition written twice within a minute", () => {
    const rows = [
      row("a", "Interviewed", "2026-04-01T10:00:00.000Z"),
      row("a", "Interviewed", "2026-04-01T10:00:00.400Z"),
    ];
    expect(dedupeHistory(rows)).toHaveLength(1);
  });

  it("keeps a repeat transition that happened later", () => {
    const rows = [
      row("a", "Interviewed", "2026-04-01T10:00:00Z"),
      row("a", "Interviewed", "2026-04-09T10:00:00Z"),
    ];
    expect(dedupeHistory(rows)).toHaveLength(2);
  });

  it("does not collapse rows from different applications", () => {
    const rows = [
      row("a", "Interviewed", "2026-04-01T10:00:00Z"),
      row("b", "Interviewed", "2026-04-01T10:00:00Z"),
    ];
    expect(dedupeHistory(rows)).toHaveLength(2);
  });
});

describe("computeYearInReview", () => {
  it("only counts applications dated inside the year", () => {
    const stats = compute([
      app({ id: "1", date_applied: "2025-12-31" }),
      app({ id: "2", date_applied: "2026-01-01" }),
      app({ id: "3", date_applied: "2026-12-31" }),
      app({ id: "4", date_applied: "2027-01-01" }),
    ]);
    expect(stats.volume.applications).toBe(2);
  });

  it("counts archived applications", () => {
    expect(compute([app({ id: "1", archived: true })]).volume.applications).toBe(1);
  });

  it("counts companies case-insensitively", () => {
    const stats = compute([
      app({ id: "1", company: "Acme" }),
      app({ id: "2", company: " acme " }),
      app({ id: "3", company: "Globex" }),
    ]);
    expect(stats.volume.companies).toBe(2);
  });

  it("buckets by date string, so Jan 1 is week 0 and Dec 31 is the last week", () => {
    const stats = compute([
      app({ id: "1", date_applied: "2026-01-01" }),
      app({ id: "2", date_applied: "2026-12-31" }),
    ]);
    expect(stats.volume.weekly[0]).toBe(1);
    expect(stats.volume.weekly[52]).toBe(1);
    expect(stats.volume.weekly.reduce((a, b) => a + b, 0)).toBe(2);
  });

  it("never reports the 1-2 day remainder at year end as the busiest week", () => {
    const stats = compute([
      app({ id: "1", date_applied: "2026-12-31" }),
      app({ id: "2", date_applied: "2026-12-31" }),
      app({ id: "3", date_applied: "2026-06-01" }),
    ]);
    expect(stats.volume.weekly[52]).toBe(2);
    expect(stats.volume.busiestWeek).toEqual({ weekStart: "2026-05-28", count: 1 });
  });

  it("finds the busiest month and week", () => {
    const stats = compute([
      app({ id: "1", date_applied: "2026-03-02" }),
      app({ id: "2", date_applied: "2026-03-03" }),
      app({ id: "3", date_applied: "2026-05-20" }),
    ]);
    expect(stats.volume.busiestMonth).toEqual({ month: 2, count: 2 });
    expect(stats.volume.busiestWeek?.count).toBe(2);
    expect(stats.volume.activeMonths).toBe(2);
  });

  it("reports the most common role using its most common spelling", () => {
    const stats = compute([
      app({ id: "1", role: "Product Designer" }),
      app({ id: "2", role: "Senior Product Designer" }),
      app({ id: "3", role: "Product Designer" }),
      app({ id: "4", role: "UX Researcher" }),
    ]);
    expect(stats.roles.topRole).toBe("Product Designer");
    expect(stats.roles.distinctRoles).toBe(2);
  });

  it("counts an application rejected after interviewing as interviewed", () => {
    const stats = compute(
      [app({ id: "1", status: "Rejected" })],
      [
        row("1", "Interview Scheduled", "2026-03-10T00:00:00Z"),
        row("1", "Rejected", "2026-03-20T00:00:00Z", "Interview Scheduled"),
      ]
    );
    expect(stats.funnel).toEqual({ applied: 1, interviewed: 1, offers: 0, hired: 0 });
  });

  it("counts current status even without history", () => {
    const stats = compute([app({ id: "1", status: "Offer" })]);
    expect(stats.funnel.interviewed).toBe(1);
    expect(stats.funnel.offers).toBe(1);
  });

  it("does not double count a duplicated history write", () => {
    const stats = compute(
      [app({ id: "1", status: "Interviewed", date_applied: "2026-03-01" })],
      [
        row("1", "Interviewed", "2026-03-11T09:00:00.000Z"),
        row("1", "Interviewed", "2026-03-11T09:00:00.300Z"),
      ]
    );
    expect(stats.funnel.interviewed).toBe(1);
  });

  it("reports median response time only with enough samples", () => {
    const apps = [
      app({ id: "1", date_applied: "2026-03-01" }),
      app({ id: "2", date_applied: "2026-03-01" }),
      app({ id: "3", date_applied: "2026-03-01" }),
    ];
    const history = [
      row("1", "Rejected", "2026-03-05T12:00:00Z"),
      row("2", "Interview Scheduled", "2026-03-11T12:00:00Z"),
      row("3", "Rejected", "2026-03-21T12:00:00Z"),
    ];
    expect(compute(apps, history).responseTime).toEqual({ medianDays: 10, sampleSize: 3 });
    expect(compute(apps, history.slice(0, MIN_RESPONSE_SAMPLES - 1)).responseTime).toBeNull();
  });

  it("counts silence only for applications still waiting after 30 days", () => {
    const stats = compute([
      app({ id: "1", date_applied: "2026-10-01" }),
      app({ id: "2", date_applied: "2026-11-20" }),
      app({ id: "3", date_applied: "2026-10-01", status: "Rejected" }),
    ]);
    expect(stats.silence.count).toBe(1);
  });

  it("picks the most recent hire as the outcome", () => {
    const stats = compute(
      [
        app({ id: "1", company: "Acme", role: "Designer", status: "Hired" }),
        app({ id: "2", company: "Globex", role: "Lead Designer", status: "Hired" }),
      ],
      [
        row("1", "Hired", "2026-05-01T00:00:00Z", "Offer"),
        row("2", "Hired", "2026-08-01T00:00:00Z", "Offer"),
      ]
    );
    expect(stats.outcome).toEqual({ company: "Globex", role: "Lead Designer" });
    expect(stats.funnel.hired).toBe(2);
  });

  it("returns an empty year without throwing", () => {
    const stats = compute([]);
    expect(stats.volume.applications).toBe(0);
    expect(stats.volume.busiestMonth).toBeNull();
    expect(stats.roles.topRole).toBeNull();
    expect(stats.label).toBeNull();
    expect(stats.outcome).toBeNull();
  });
});

describe("assignLabel", () => {
  const base: LabelInput = {
    applications: 10,
    interviewed: 0,
    distinctRoles: 1,
    weekly: Array.from({ length: 53 }, (_, i) => (i % 5 === 0 ? 1 : 0)),
    work: EMPTY_ACTIVITY,
  };

  it("gives no label below the minimum", () => {
    expect(assignLabel({ ...base, applications: LABEL_THRESHOLDS.minApplications - 1 })).toBeNull();
  });

  it("checks behaviour rules in order", () => {
    const everything = {
      ...base,
      interviewed: 10,
      distinctRoles: 10,
      work: { ...EMPTY_ACTIVITY, contactsContacted: 9, coverLetters: 9, fitAnalyses: 9 },
    };
    expect(assignLabel(everything)).toBe("connector");
    expect(assignLabel({ ...everything, work: { ...everything.work, contactsContacted: 0 } })).toBe("craftsperson");
  });

  it("labels a short, effective list as The Curator", () => {
    expect(assignLabel({ ...base, applications: 8, interviewed: 3 })).toBe("curator");
  });

  it("labels heavy fit analysis as The Researcher", () => {
    expect(assignLabel({ ...base, work: { ...EMPTY_ACTIVITY, fitAnalyses: 6 } })).toBe("researcher");
  });

  it("labels varied titles as The Explorer", () => {
    expect(assignLabel({ ...base, distinctRoles: 5 })).toBe("explorer");
  });

  it("falls back to timing: concentrated is The Sprint, spread out is The Long Game", () => {
    const concentrated = new Array(53).fill(0);
    concentrated[10] = 6;
    concentrated[12] = 4;
    expect(assignLabel({ ...base, weekly: concentrated })).toBe("sprint");
    expect(assignLabel(base)).toBe("long-game");
  });
});

describe("peakWindowShare", () => {
  it("measures the densest window", () => {
    const weekly = new Array(53).fill(0);
    weekly[0] = 2;
    weekly[7] = 2;
    weekly[30] = 4;
    expect(peakWindowShare(weekly, 8)).toBe(0.5);
    expect(peakWindowShare(new Array(53).fill(0), 8)).toBe(0);
  });
});

describe("share token", () => {
  const secret = "a".repeat(40);
  const stats = compute(
    [app({ id: "1", status: "Hired", company: "Acme" })],
    [row("1", "Hired", "2026-05-01T00:00:00Z", "Offer")]
  );

  it("round-trips a signed payload", () => {
    const payload = buildSharePayload(stats, { includeOutcome: true });
    expect(decodeShareToken(encodeShareToken(payload, secret), secret)).toEqual(payload);
  });

  it("omits the company unless the owner opts in", () => {
    expect(buildSharePayload(stats, { includeOutcome: false }).hc).toBeUndefined();
    expect(buildSharePayload(stats, { includeOutcome: true }).hc).toBe("Acme");
  });

  it("never carries the private silence count", () => {
    expect(JSON.stringify(buildSharePayload(stats, { includeOutcome: true }))).not.toMatch(/silence/);
  });

  it("rejects a tampered payload", () => {
    const token = encodeShareToken(buildSharePayload(stats, { includeOutcome: false }), secret);
    const [, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ v: 1, y: 2026, a: 999, c: 1, i: 1, o: 1, l: null, m: null })).toString("base64url");
    expect(decodeShareToken(`${forged}.${signature}`, secret)).toBeNull();
  });

  it("rejects a token signed with another secret and malformed input", () => {
    const token = encodeShareToken(buildSharePayload(stats, { includeOutcome: false }), secret);
    expect(decodeShareToken(token, "b".repeat(40))).toBeNull();
    expect(decodeShareToken("not-a-token", secret)).toBeNull();
    expect(decodeShareToken("a.b.c", secret)).toBeNull();
  });
});

describe("launch gate and years", () => {
  // Imported here so the module-level env reads below see the test's values.
  const { isYearInReviewEnabled, isYearInReviewSurface } = require("@/lib/year-in-review/gate");
  const { defaultReviewYear, isReviewableYear } = require("@/lib/year-in-review/years");
  const { resolveSharePayload } = require("@/lib/year-in-review/share-page");
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("gates every surface on segment boundaries", () => {
    expect(isYearInReviewSurface("/dashboard/year-in-review")).toBe(true);
    expect(isYearInReviewSurface("/year-in-review/abc.def")).toBe(true);
    expect(isYearInReviewSurface("/year-in-review/abc.def/story")).toBe(true);
    expect(isYearInReviewSurface("/api/year-in-review/share")).toBe(true);
    expect(isYearInReviewSurface("/year-in-reviewer")).toBe(false);
    expect(isYearInReviewSurface("/dashboard")).toBe(false);
  });

  it("is off unless explicitly enabled", () => {
    delete process.env.YEAR_IN_REVIEW_ENABLED;
    expect(isYearInReviewEnabled()).toBe(false);
    process.env.YEAR_IN_REVIEW_ENABLED = "1";
    expect(isYearInReviewEnabled()).toBe(true);
  });

  it("reviews last year in January and this year otherwise", () => {
    expect(defaultReviewYear(new Date("2027-01-10T00:00:00Z"))).toBe(2026);
    expect(defaultReviewYear(new Date("2026-12-10T00:00:00Z"))).toBe(2026);
  });

  it("rejects future and pre-product years", () => {
    const now = new Date("2026-12-10T00:00:00Z");
    expect(isReviewableYear(2026, now)).toBe(true);
    expect(isReviewableYear(2027, now)).toBe(false);
    expect(isReviewableYear(2019, now)).toBe(false);
    expect(isReviewableYear(2026.5, now)).toBe(false);
  });

  it("resolves share pages only when enabled and configured", () => {
    const secret = "s".repeat(40);
    const stats = compute([app({ id: "1" })]);
    const token = encodeShareToken(buildSharePayload(stats, { includeOutcome: false }), secret);

    process.env.YEAR_IN_REVIEW_ENABLED = "1";
    process.env.YEAR_IN_REVIEW_SHARE_SECRET = secret;
    expect(resolveSharePayload(token)?.a).toBe(1);

    process.env.YEAR_IN_REVIEW_SHARE_SECRET = "too-short";
    expect(resolveSharePayload(token)).toBeNull();

    process.env.YEAR_IN_REVIEW_SHARE_SECRET = secret;
    delete process.env.YEAR_IN_REVIEW_ENABLED;
    expect(resolveSharePayload(token)).toBeNull();
  });
});
