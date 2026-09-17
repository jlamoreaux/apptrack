/**
 * The help page is built from constants the product also uses, so it cannot
 * describe the four areas or the coverage target differently from the code.
 */

import { HELP_SECTIONS } from "@/lib/constants/help-content";
import { WIN_TAG_OPTIONS } from "@/lib/constants/careerotter";
import { COVERAGE_TARGET_PER_AREA } from "@/lib/careerotter/coverage";

describe("HELP_SECTIONS", () => {
  it("every section has an id, a title, an intro, and at least one answered question", () => {
    expect(HELP_SECTIONS.length).toBeGreaterThan(0);
    for (const s of HELP_SECTIONS) {
      expect(s.id).toMatch(/^[a-z-]+$/);
      expect(s.title.trim()).not.toBe("");
      expect(s.intro.trim()).not.toBe("");
      expect(s.items.length).toBeGreaterThan(0);
      for (const item of s.items) {
        expect(item.question.trim()).not.toBe("");
        expect(item.answer.trim()).not.toBe("");
      }
    }
  });

  it("section ids are unique (they are anchor targets)", () => {
    const ids = HELP_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names every impact area with its hint", () => {
    const areas = HELP_SECTIONS.find((s) => s.id === "areas")!;
    const text = areas.items.map((i) => i.answer).join(" ");
    for (const o of WIN_TAG_OPTIONS) {
      expect(text).toContain(`${o.label}:`);
      expect(text.toLowerCase()).toContain(o.hint.toLowerCase());
    }
  });

  it("states the real coverage target", () => {
    const coverage = HELP_SECTIONS.find((s) => s.id === "coverage")!;
    const text = coverage.items.map((i) => i.answer).join(" ");
    expect(text).toContain(`${COVERAGE_TARGET_PER_AREA} wins`);
  });

  it("carries the Free/Pro answers from the homepage FAQ", () => {
    const plans = HELP_SECTIONS.find((s) => s.id === "plans")!;
    expect(plans.items.map((i) => i.question)).toEqual([
      "What's the difference between Free and Pro?",
      "Do I need a credit card to start?",
    ]);
  });

  it("links only to in-app routes", () => {
    for (const s of HELP_SECTIONS) {
      if (s.link) expect(s.link.href).toMatch(/^\/dashboard(\/|$)/);
    }
  });
});
