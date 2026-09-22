/**
 * Guards lib/constants/careerotter.ts against drift from the SQL CHECK lists in
 * schemas/migrations/032_careerotter_evidence.sql. If someone changes a CHECK in
 * the migration without updating the constant (or vice versa), this fails.
 * wins.source is guarded in agent-access.test.ts (its current CHECK is in 044).
 */

import { readFileSync } from "fs";
import { join } from "path";
import {
  CAREER_MODES,
  WIN_TAGS,
  CAREER_MODE_OPTIONS,
  CAREER_MODE_GOAL_LABEL,
  WIN_TAG_OPTIONS,
} from "@/lib/constants/careerotter";

const migration = readFileSync(
  join(process.cwd(), "schemas/migrations/032_careerotter_evidence.sql"),
  "utf8"
);

/** Pull the values out of `check (<col> in ('a', 'b', ...))` for a column. */
function checkValues(column: string): string[] {
  const re = new RegExp(`check \\(${column} in \\(([^)]*)\\)`, "i");
  const m = migration.match(re);
  if (!m) throw new Error(`no CHECK found for ${column}`);
  return Array.from(m[1].matchAll(/'([^']+)'/g)).map((x) => x[1]);
}

describe("careerotter constants mirror the SQL CHECK lists", () => {
  it("CAREER_MODES matches career_profiles.mode", () => {
    expect([...CAREER_MODES].sort()).toEqual(checkValues("mode").sort());
  });

  it("WIN_TAGS matches wins.tag", () => {
    expect([...WIN_TAGS].sort()).toEqual(checkValues("tag").sort());
  });
});

describe("option lists stay aligned with their value lists", () => {
  it("mode options cover every mode", () => {
    expect(CAREER_MODE_OPTIONS.map((o) => o.value).sort()).toEqual(
      [...CAREER_MODES].sort()
    );
  });

  it("tag options cover every tag", () => {
    expect(WIN_TAG_OPTIONS.map((o) => o.value).sort()).toEqual(
      [...WIN_TAGS].sort()
    );
  });

  it("goal labels cover every mode", () => {
    expect(Object.keys(CAREER_MODE_GOAL_LABEL).sort()).toEqual(
      [...CAREER_MODES].sort()
    );
  });
});
