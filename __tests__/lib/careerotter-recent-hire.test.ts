/**
 * "Did this user just start a new job?" Reads application_history transitions
 * rather than applications.updated_at, because the handle_updated_at trigger
 * bumps updated_at on any edit — so a note added to a months-old Hired row used
 * to look like a fresh hire.
 */

// @jest-environment node

import {
  findRecentHire,
  RECENT_HIRE_DAYS,
  type HireTransition,
} from "@/lib/careerotter/recent-hire";

const NOW = new Date("2026-06-15T12:00:00Z");
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();

const hire = (
  company: string,
  role: string,
  days: number,
  archived: boolean | null = false
): HireTransition => ({
  changed_at: daysAgo(days),
  applications: { company, role, archived },
});

describe("findRecentHire", () => {
  it("is null with no transitions", () => {
    expect(findRecentHire([], NOW)).toBeNull();
  });

  it("finds a hire inside the window", () => {
    expect(findRecentHire([hire("Globex", "Staff Engineer", 3)], NOW)).toEqual({
      company: "Globex",
      role: "Staff Engineer",
    });
  });

  it("ignores a hire older than the window", () => {
    const old = hire("Initech", "Engineer", RECENT_HIRE_DAYS + 1);
    expect(findRecentHire([old], NOW)).toBeNull();
  });

  it("keeps a hire on the last day of the window", () => {
    const edge = hire("Initech", "Engineer", RECENT_HIRE_DAYS - 1);
    expect(findRecentHire([edge], NOW)?.company).toBe("Initech");
  });

  it("takes the most recent when there are several", () => {
    const transitions = [
      hire("Initech", "Engineer", 30),
      hire("Globex", "Staff Engineer", 2),
      hire("Acme", "Engineer", 12),
    ];
    expect(findRecentHire(transitions, NOW)?.company).toBe("Globex");
  });

  it("skips archived applications", () => {
    expect(findRecentHire([hire("Globex", "Staff Engineer", 2, true)], NOW)).toBeNull();
  });

  it("survives rows the join could not resolve or that have no timestamp", () => {
    const transitions: HireTransition[] = [
      { changed_at: daysAgo(1), applications: null },
      { changed_at: null, applications: { company: "Globex", role: "Engineer" } },
      { changed_at: "not a date", applications: { company: "Acme", role: "Engineer" } },
      hire("Initech", "Staff Engineer", 5),
    ];
    expect(findRecentHire(transitions, NOW)?.company).toBe("Initech");
  });

  it("treats a missing archived field as live", () => {
    const transition: HireTransition = {
      changed_at: daysAgo(1),
      applications: { company: "Globex", role: "Engineer" },
    };
    expect(findRecentHire([transition], NOW)?.company).toBe("Globex");
  });
});
