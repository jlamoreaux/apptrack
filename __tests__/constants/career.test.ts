/**
 * Tests for lib/constants/career.ts
 * Guards drift between the TS constants (single source of truth for app code)
 * and the SQL CHECK constraints in schemas/migrations/031_career_waitlist.sql.
 */

// @jest-environment node

import { readFileSync } from "fs";
import { join } from "path";
import {
  CAREER_CAMPAIGN,
  CAREER_WAITLIST_SOURCES,
  REVIEW_TIMING_OPTIONS,
} from "@/lib/constants/career";

const MIGRATION_PATH = join(
  process.cwd(),
  "schemas/migrations/031_career_waitlist.sql"
);

/**
 * Returns the body of the named CHECK constraint, e.g. the
 * "review_timing IN (...)" expression, so value assertions target the
 * constraint itself rather than anywhere in the file.
 */
function extractCheckConstraint(sql: string, constraintName: string): string {
  const pattern = new RegExp(
    `CONSTRAINT\\s+${constraintName}\\s+CHECK\\s*\\(([\\s\\S]*?)\\)\\s*\\)?,?\\s*\\n`,
    "i"
  );
  const match = sql.match(pattern);
  if (!match || match[1] === undefined) {
    throw new Error(
      `CHECK constraint "${constraintName}" not found in ${MIGRATION_PATH}`
    );
  }
  return match[1];
}

describe("career constants vs migration 031 SQL CHECKs", () => {
  const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

  it("every REVIEW_TIMING_OPTIONS value appears in the review_timing CHECK", () => {
    const checkBody = extractCheckConstraint(
      migrationSql,
      "career_waitlist_review_timing_check"
    );
    for (const option of REVIEW_TIMING_OPTIONS) {
      expect(checkBody).toContain(`'${option.value}'`);
    }
  });

  it("the review_timing CHECK contains no values missing from REVIEW_TIMING_OPTIONS", () => {
    const checkBody = extractCheckConstraint(
      migrationSql,
      "career_waitlist_review_timing_check"
    );
    const sqlValues = [...checkBody.matchAll(/'([^']+)'/g)].map(
      (match) => match[1]
    );
    const tsValues = REVIEW_TIMING_OPTIONS.map((option) => option.value);
    expect(sqlValues.sort()).toEqual([...tsValues].sort());
  });

  it("every CAREER_WAITLIST_SOURCES value appears in the source CHECK", () => {
    const checkBody = extractCheckConstraint(
      migrationSql,
      "career_waitlist_source_check"
    );
    for (const source of CAREER_WAITLIST_SOURCES) {
      expect(checkBody).toContain(`'${source}'`);
    }
  });

  it("the source CHECK contains no values missing from CAREER_WAITLIST_SOURCES", () => {
    const checkBody = extractCheckConstraint(
      migrationSql,
      "career_waitlist_source_check"
    );
    const sqlValues = [...checkBody.matchAll(/'([^']+)'/g)].map(
      (match) => match[1]
    );
    expect(sqlValues.sort()).toEqual([...CAREER_WAITLIST_SOURCES].sort());
  });
});

describe("career constants shapes", () => {
  it("REVIEW_TIMING_OPTIONS has the expected values and labels", () => {
    expect(REVIEW_TIMING_OPTIONS).toEqual([
      { value: "lt_3_months", label: "Within 3 months" },
      { value: "3_6_months", label: "3–6 months" },
      { value: "6_12_months", label: "6–12 months" },
      { value: "no_formal_reviews", label: "No formal reviews" },
      { value: "not_sure", label: "Not sure" },
    ]);
  });

  it("REVIEW_TIMING_OPTIONS values are unique", () => {
    const values = REVIEW_TIMING_OPTIONS.map((option) => option.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("CAREER_WAITLIST_SOURCES has the expected values", () => {
    expect(CAREER_WAITLIST_SOURCES).toEqual(["email", "banner", "direct"]);
  });

  it("CAREER_CAMPAIGN is the validation campaign id", () => {
    expect(CAREER_CAMPAIGN).toBe("career_companion_validation");
  });
});
