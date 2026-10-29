/**
 * The expression translator behind the D1 schema port.
 *
 * Every case below is a VERBATIM expression from production's catalog, not an invented
 * example. They are the CHECK constraints and partial-index predicates that carry the
 * database's invariants, and the D1 baseline is only as trustworthy as this translation:
 * a CHECK that always passes is indistinguishable from one that works until bad data
 * arrives, and a partial-unique index whose predicate never matches silently stops
 * enforcing uniqueness.
 *
 * The translator throws on anything it does not recognise, so the generator reports an
 * omission rather than emitting a weakened constraint. That behaviour is tested too.
 */
// Plain .mjs so the generator scripts and this test share one implementation; the
// translator is the only thing standing between production's invariants and D1.
import { translate, checkBody } from "../../scripts/migration/pg-to-sqlite-expr.mjs";

describe("checkBody", () => {
  it("unwraps the CHECK(...) that pg_get_constraintdef emits", () => {
    expect(checkBody("CHECK ((display_order > 0))")).toBe("(display_order > 0)");
  });

  it("rejects a definition that is not a CHECK", () => {
    expect(() => checkBody("UNIQUE (user_id)")).toThrow(/not a CHECK/);
  });
});

describe("translate — enum CHECKs", () => {
  it("rewrites = ANY (ARRAY[...]) as IN (...), dropping ::text casts", () => {
    expect(
      translate(
        "((status = ANY (ARRAY['Applied'::text, 'Interview Scheduled'::text, " +
          "'Interviewed'::text, 'Offer'::text, 'Hired'::text, 'Rejected'::text])))"
      )
    ).toBe(
      `"status" IN ('Applied', 'Interview Scheduled', 'Interviewed', 'Offer', 'Hired', 'Rejected')`
    );
  });

  it("preserves a hyphenated literal", () => {
    expect(
      translate("((audience = ANY (ARRAY['leads'::text, 'free-users'::text])))")
    ).toBe(`"audience" IN ('leads', 'free-users')`);
  });
});

describe("translate — range CHECKs", () => {
  it("keeps a two-sided bound as a conjunction", () => {
    expect(translate("(((fit_score >= 0) AND (fit_score <= 100)))")).toBe(
      `("fit_score" >= 0) AND ("fit_score" <= 100)`
    );
  });

  it("keeps a single bound", () => {
    expect(translate("((display_order > 0))")).toBe(`"display_order" > 0`);
  });
});

describe("translate — booleans become INTEGER 0/1", () => {
  // SQLite has no boolean type, so a predicate left as `= true` would never match and the
  // partial index would quietly cover no rows.
  it("maps true to 1", () => {
    expect(translate("(active = true)")).toBe(`"active" = 1`);
  });

  it("maps false to 0", () => {
    expect(translate("(onboarding_completed = false)")).toBe(
      `"onboarding_completed" = 0`
    );
  });

  it("handles a conjunction of two boolean tests", () => {
    expect(translate("((is_welcome_offer = true) AND (active = true))")).toBe(
      `("is_welcome_offer" = 1) AND ("active" = 1)`
    );
  });
});

describe("translate — functions", () => {
  it("rewrites TRIM(BOTH FROM x)", () => {
    expect(translate("((TRIM(BOTH FROM name) <> ''::text))")).toBe(`trim("name") <> ''`);
  });

  // %w is 0=Sunday..6=Saturday, which matches Postgres `dow`. `isodow` differs only for
  // Sunday (7 vs 0), and both production constraints compare against Monday, where they agree.
  it("rewrites EXTRACT(dow) against Monday via strftime", () => {
    expect(translate("((EXTRACT(dow FROM week_start) = (1)::numeric))")).toBe(
      `CAST(strftime('%w', "week_start") AS INTEGER) = 1`
    );
  });

  it("rewrites EXTRACT(isodow) against Monday identically", () => {
    expect(translate("((EXTRACT(isodow FROM week_start) = (1)::numeric))")).toBe(
      `CAST(strftime('%w', "week_start") AS INTEGER) = 1`
    );
  });

  it("refuses EXTRACT against any other day, where isodow and dow disagree", () => {
    expect(() => translate("((EXTRACT(isodow FROM d) = (7)::numeric))")).toThrow(
      /isodow and dow disagree/
    );
  });
});

describe("translate — null tests and literals", () => {
  it("passes IS NOT NULL through with quoting", () => {
    expect(translate("(converted_user_id IS NOT NULL)")).toBe(
      `"converted_user_id" IS NOT NULL`
    );
  });

  it("strips the ::text cast from a compared literal", () => {
    expect(translate("(status = 'pending'::text)")).toBe(`"status" = 'pending'`);
  });
});

describe("translate — refusal is the safety property", () => {
  it.each([
    ["a jsonb operator", "(payload ->> 'k' = 'v')"],
    ["a subquery", "(user_id IN (SELECT id FROM users))"],
    ["a regex match", "(email ~ '^.+@.+$')"],
    ["an unquotable function call", "(lower(email) = 'a@b.c')"],
  ])("throws on %s rather than guessing", (_label, expr) => {
    expect(() => translate(expr)).toThrow(/unrecognised expression/);
  });
});
