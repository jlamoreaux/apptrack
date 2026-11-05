import { assessModelShutdown, SHUTDOWN_WARNING_DAYS } from "@/lib/openai/model-lifecycle";

const NOW = new Date("2026-11-04T12:00:00Z");

describe("assessModelShutdown", () => {
  it.each([[null], [undefined]])("treats %s as no announced shutdown", (date) => {
    expect(assessModelShutdown("m", date, NOW)).toEqual({
      model: "m",
      shutdownDate: null,
      daysLeft: null,
      problem: null,
    });
  });

  it("passes a shutdown beyond the warning window", () => {
    const result = assessModelShutdown("m", "2027-06-01", NOW);
    expect(result.problem).toBeNull();
    expect(result.daysLeft).toBeGreaterThan(SHUTDOWN_WARNING_DAYS);
  });

  it("flags a shutdown inside the warning window", () => {
    const result = assessModelShutdown("m", "2027-01-14", NOW);
    expect(result.daysLeft).toBe(71);
    expect(result.problem).toContain("2027-01-14");
  });

  it("flags the last day of the window and not the day after", () => {
    expect(assessModelShutdown("m", "2027-02-02", NOW).daysLeft).toBe(90);
    expect(assessModelShutdown("m", "2027-02-02", NOW).problem).not.toBeNull();
    expect(assessModelShutdown("m", "2027-02-03", NOW).problem).toBeNull();
  });

  it("flags a date already past", () => {
    const result = assessModelShutdown("m", "2026-10-23", NOW);
    expect(result.daysLeft).toBeLessThan(0);
    expect(result.problem).not.toBeNull();
  });

  it.each([[1767225600], ["next year"], ["2027-13-45"], [""]])(
    "flags %s as unreadable rather than safe",
    (date) => {
      expect(assessModelShutdown("m", date, NOW).problem).toContain("unreadable");
    }
  );
});
