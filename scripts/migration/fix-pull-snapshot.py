#!/usr/bin/env python3
"""Repair the snapshot that `drizzle-kit pull` writes.

drizzle-kit 0.31.10 has a round-trip bug: `pull` copies Postgres's reloptions verbatim,
so a view created with `WITH (security_invoker=on)` is recorded as the STRING "on":

    "with": {"securityInvoker": "on"}

Its own snapshot validator requires a BOOLEAN there, so every subsequent
`drizzle-kit generate` / `check` fails with "0000_snapshot.json data is malformed".

Run this after any `drizzle-kit pull`. Idempotent.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
BOOLISH = {"on": True, "true": True, "off": False, "false": False}


def coerce(node) -> int:
    """Recursively coerce string booleans inside view `with` blocks. Returns fix count."""
    fixed = 0
    if isinstance(node, dict):
        for key, value in list(node.items()):
            if key == "with" and isinstance(value, dict):
                for opt, optval in list(value.items()):
                    if isinstance(optval, str) and optval.lower() in BOOLISH:
                        value[opt] = BOOLISH[optval.lower()]
                        fixed += 1
            else:
                fixed += coerce(value)
    elif isinstance(node, list):
        for item in node:
            fixed += coerce(item)
    return fixed


def fix_schema_ts() -> int:
    """Repair two `drizzle-kit pull` defects in the generated schema.ts.

    1. `.with({"securityInvoker":"on"})` - Postgres reloptions copied verbatim as a
       string where drizzle's own validator requires a boolean.
    2. `.default(\')` - a column whose Postgres default is the empty string (``\'\'::text``)
       is emitted with an unterminated string literal, so esbuild cannot parse the file
       and every `drizzle-kit generate` dies with a TransformError.
    """
    path = ROOT / "lib/db/schema/schema.ts"
    if not path.exists():
        return 0
    text = path.read_text()
    fixed = re.sub(
        r'("securityInvoker"\s*:\s*)"(on|off|true|false)"',
        lambda m: m.group(1) + ("true" if m.group(2) in ("on", "true") else "false"),
        text,
    )
    # .default(')  ->  .default('')   (empty-string default, unterminated by pull)
    fixed = re.sub(r"\.default\('\)(?=\s*[,\)])", ".default('')", fixed)
    if fixed != text:
        path.write_text(fixed)
        n = len(re.findall(r'"securityInvoker"\s*:\s*(?:true|false)', fixed))
        print(f"lib/db/schema/schema.ts: coerced securityInvoker to boolean ({n} site(s))")
        return 1
    return 0


def fix_expression_index_opclasses(data) -> int:
    """Fold an expression index's `opclass` into its expression.

    `drizzle-kit pull` records an expression index as
        {"expression": "to_tsvector(...)", "opclass": "tsvector_ops"}
    but the schema DSL has no way to attach an opclass to a raw `sql` expression, so
    `generate` recomputes it as
        {"expression": "to_tsvector(...) tsvector_ops"}
    The two never match, and every `generate` emits a spurious DROP INDEX / CREATE INDEX
    pair for a byte-identical index. Normalising the snapshot to the generate-side shape
    makes the baseline stable.
    """
    fixed = 0
    for table in data.get("tables", {}).values():
        for index in table.get("indexes", {}).values():
            for col in index.get("columns", []):
                if col.get("isExpression") and col.get("opclass"):
                    col["expression"] = f"{col['expression']} {col.pop('opclass')}"
                    fixed += 1
    return fixed


def main() -> int:
    total = 0
    snapshots = sorted((ROOT / "drizzle/meta").glob("*_snapshot.json"))
    if not snapshots:
        print("no snapshots found under drizzle/meta", file=sys.stderr)
        return 1
    for path in snapshots:
        data = json.loads(path.read_text())
        n = coerce(data) + fix_expression_index_opclasses(data)
        if n:
            path.write_text(json.dumps(data, indent=2))
            print(f"{path.relative_to(ROOT)}: coerced {n} string boolean(s)")
        total += n
    total += fix_schema_ts()
    print("no changes needed" if not total else f"fixed {total} value(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
