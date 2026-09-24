#!/usr/bin/env python3
"""Generate drizzle/0002_extras.sql from the production schema dump.

drizzle-kit pull captures tables, columns, indexes, constraints, policies and plain
views, but NOT plpgsql functions, triggers, or materialized views. Without those the
baseline does not reproduce production, so `drizzle-kit generate` would happily report
"no changes" against a database that is materially different.

Usage:
    python3 scripts/migration/gen-extras.py

Reads:  db/prod-truth/01_public_schema.sql   (refresh via scripts/migration/dump-prod-truth.sh)
Writes: drizzle/0002_extras.sql
"""
import re
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "db/prod-truth/01_public_schema.sql"
DEST = ROOT / "drizzle/0002_extras.sql"

# pg_dump precedes every object with:  --\n-- Name: X; Type: T; Schema: S; Owner: -\n--\n
HEADER = re.compile(
    r"^--\n-- Name: (?P<name>.+?); Type: (?P<type>[A-Z ]+); Schema: (?P<schema>[^;]+); Owner:.*?\n--\n",
    re.M,
)

HEAD = """-- 0001_extras.sql — objects drizzle-kit cannot express
--
-- drizzle-kit pull captures tables, columns, indexes, constraints, policies and plain
-- views, but NOT plpgsql functions, triggers, or materialized views. Without this file
-- the baseline does not reproduce production.
--
-- Generated from db/prod-truth/01_public_schema.sql by scripts/migration/gen-extras.py.
-- Regenerate rather than hand-editing.
--
-- NOTE: this file deliberately reproduces production AS IT IS, including known defects,
-- because a baseline's job is fidelity, not correction. Defects are removed later, in
-- their own migrations, so each change is attributable. Known issues reproduced here:
--   * get_next_display_order() uses FOR UPDATE with an aggregate and always raises
--     "FOR UPDATE is not allowed with aggregate functions".
--   * handle_new_user_subscription() is defined but attached to no trigger.
--   * application_ai_analyses.interview_prep_count is 0 for every row.
"""


def main() -> int:
    if not SRC.exists():
        print(f"missing {SRC}; run scripts/migration/dump-prod-truth.sh first", file=sys.stderr)
        return 1

    src = SRC.read_text()
    matches = list(HEADER.finditer(src))
    sections = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(src)
        sections.append((m.group("type").strip(), m.group("name"), src[m.end():end].strip()))

    def of(kind):
        return [(n, b) for t, n, b in sections if t == kind]

    funcs, trigs, matviews = of("FUNCTION"), of("TRIGGER"), of("MATERIALIZED VIEW")
    mv_names = {n.split()[0] for n, _ in matviews}
    mv_indexes = [
        (n, b)
        for n, b in of("INDEX")
        if any(re.search(rf"\bON public\.{re.escape(mv)}\b", b) for mv in mv_names)
    ]

    parts = [HEAD]
    # Order matters: functions before the triggers that reference them; the
    # materialized view before its indexes.
    for title, items in (
        (f"FUNCTIONS ({len(funcs)})", funcs),
        (f"MATERIALIZED VIEWS ({len(matviews)})", matviews),
        (f"MATERIALIZED VIEW INDEXES ({len(mv_indexes)})", mv_indexes),
        (f"TRIGGERS ({len(trigs)})", trigs),
    ):
        parts.append(f"\n-- ============ {title} ============\n")
        parts.extend(f"-- {n}\n{b}\n" for n, b in items)

    DEST.write_text("\n".join(parts))
    print(
        f"wrote {DEST.relative_to(ROOT)}: "
        f"functions={len(funcs)} matviews={len(matviews)} "
        f"mv_indexes={len(mv_indexes)} triggers={len(trigs)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
