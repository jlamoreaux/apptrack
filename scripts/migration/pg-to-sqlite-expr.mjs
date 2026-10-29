/**
 * Translates Postgres boolean expressions into SQLite.
 *
 * Shared by the D1 schema generator for two things that both carry real invariants:
 * CHECK constraint bodies and partial-index predicates. They are the same grammar, and a
 * silent mistranslation in either is worse than a missing constraint — a CHECK that always
 * passes looks identical to one that works until bad data arrives.
 *
 * The translator is deliberately NARROW. It handles exactly the forms production uses and
 * throws on anything else, so an unrecognised expression fails the generator rather than
 * being emitted wrong or dropped. `translate()` returning a string means it was understood.
 *
 * Forms handled, all taken from the live catalog:
 *
 *   x = ANY (ARRAY['a'::text, 'b'::text])  ->  "x" IN ('a', 'b')
 *   x = true / x = false                   ->  "x" = 1 / "x" = 0      (boolean is INTEGER)
 *   'lit'::text                            ->  'lit'
 *   TRIM(BOTH FROM x) <> ''::text          ->  trim("x") <> ''
 *   EXTRACT(isodow FROM d) = 1             ->  CAST(strftime('%w', "d") AS INTEGER) = 1
 *   x >= 0, x <= 100, x > 0, x IS NOT NULL ->  unchanged but for quoting
 *   (a) AND (b), (a) OR (b)                ->  structure preserved
 */

/** Postgres wraps most catalog-rendered expressions in redundant parens. */
function stripOuterParens(s) {
  let out = s.trim();
  while (out.startsWith("(") && out.endsWith(")")) {
    // Only strip when the leading paren actually matches the trailing one, so
    // "(a) AND (b)" is left intact.
    let depth = 0;
    let matches = true;
    for (let i = 0; i < out.length; i++) {
      if (out[i] === "(") depth++;
      else if (out[i] === ")") {
        depth--;
        if (depth === 0 && i !== out.length - 1) {
          matches = false;
          break;
        }
      }
    }
    if (!matches) break;
    out = out.slice(1, -1).trim();
  }
  return out;
}

/** Splits on a top-level AND/OR, returning null when there is none. */
function splitTopLevel(s) {
  let depth = 0;
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'") inString = !inString;
    if (inString) continue;
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0) {
      for (const op of ["AND", "OR"]) {
        if (
          s.slice(i, i + op.length).toUpperCase() === op &&
          /\s/.test(s[i - 1] ?? " ") &&
          /\s/.test(s[i + op.length] ?? " ")
        ) {
          return { op, left: s.slice(0, i), right: s.slice(i + op.length) };
        }
      }
    }
  }
  return null;
}

/** Quotes a bare column reference; leaves anything already quoted alone. */
const col = (name) => (name.startsWith('"') ? name : `"${name}"`);

/** `'a'::text, 'b'::text` -> `'a', 'b'`. */
function stripCasts(s) {
  return s.replace(/::[a-z_ ]+(\[\])?/gi, "");
}

const IDENT = "[a-z_][a-z0-9_]*";

function translateLeaf(expr) {
  const s = stripOuterParens(expr);

  // x = ANY (ARRAY[...])  — the enum pattern behind 20 of the 28 CHECK constraints.
  let m = s.match(new RegExp(`^(${IDENT})\\s*=\\s*ANY\\s*\\(\\s*ARRAY\\[(.*)\\]\\s*\\)$`, "is"));
  if (m) return `${col(m[1])} IN (${stripCasts(m[2]).replace(/\s*,\s*/g, ", ").trim()})`;

  // TRIM(BOTH FROM x) <> ''::text
  m = s.match(new RegExp(`^TRIM\\s*\\(\\s*BOTH\\s+FROM\\s+(${IDENT})\\s*\\)\\s*(<>|=)\\s*''(::text)?$`, "is"));
  if (m) return `trim(${col(m[1])}) ${m[2]} ''`;

  // EXTRACT(isodow|dow FROM d) = n. SQLite's %w is 0=Sunday..6=Saturday, which agrees with
  // Postgres `dow`; `isodow` differs only for Sunday (7 vs 0), and production compares
  // against 1 (Monday) in both, where they coincide.
  m = s.match(new RegExp(`^EXTRACT\\s*\\(\\s*(isodow|dow)\\s+FROM\\s+(${IDENT})\\s*\\)\\s*=\\s*\\(?(\\d+)\\)?(::numeric)?$`, "is"));
  if (m) {
    if (m[3] !== "1") {
      throw new Error(
        `EXTRACT(${m[1]}) compared against ${m[3]}: isodow and dow disagree outside Monday, ` +
          `so this needs a hand-written translation rather than %w`
      );
    }
    return `CAST(strftime('%w', ${col(m[2])}) AS INTEGER) = 1`;
  }

  // x IS [NOT] NULL
  m = s.match(new RegExp(`^(${IDENT})\\s+IS\\s+(NOT\\s+)?NULL$`, "is"));
  if (m) return `${col(m[1])} IS ${m[2] ? "NOT " : ""}NULL`;

  // x = true / x = false  — boolean columns are INTEGER 0/1 in SQLite.
  m = s.match(new RegExp(`^(${IDENT})\\s*=\\s*(true|false)$`, "is"));
  if (m) return `${col(m[1])} = ${/true/i.test(m[2]) ? "1" : "0"}`;

  // x <op> <number>  and  x <op> 'literal'::text
  m = s.match(new RegExp(`^(${IDENT})\\s*(=|<>|!=|>=|<=|>|<)\\s*(.+)$`, "is"));
  if (m) {
    const rhs = stripCasts(m[3]).trim();
    if (/^-?\d+(\.\d+)?$/.test(rhs) || /^'[^']*'$/.test(rhs)) {
      return `${col(m[1])} ${m[2]} ${rhs}`;
    }
  }

  throw new Error(`unrecognised expression: ${expr}`);
}

/**
 * Translates a Postgres boolean expression to SQLite, or throws.
 *
 * Throwing is the point: the caller turns a failure into a reported, named omission so a
 * constraint is never silently dropped or silently weakened.
 */
export function translate(expr) {
  const s = stripOuterParens(expr);
  const split = splitTopLevel(s);
  if (split) {
    return `(${translate(split.left)}) ${split.op} (${translate(split.right)})`;
  }
  return translateLeaf(s);
}

/** Strips the leading `CHECK (...)` that pg_get_constraintdef emits. */
export function checkBody(constraintDef) {
  const m = constraintDef.match(/^CHECK\s*\((.*)\)$/is);
  if (!m) throw new Error(`not a CHECK definition: ${constraintDef}`);
  return m[1];
}
