#!/usr/bin/env bash
# Verifies that drizzle/0000_*.sql + drizzle/0001_extras.sql together account for every
# object in production.
#
# This is an OBJECT-INVENTORY check, not a full structural diff. It catches omissions
# (a table, index, policy, function or trigger that the baseline forgot) but not subtle
# differences in a column's type or default.
#
# The full equivalence gate — apply the baseline to an empty PG17 and `migra` it against
# production — still needs a scratch PG17 (a Neon branch). Run that before cutover.
set -uo pipefail
cd "$(dirname "$0")/../.."

PROD=db/prod-truth/01_public_schema.sql
BASE=$(ls drizzle/0000_*.sql 2>/dev/null | head -1)
EXTRAS=drizzle/0002_extras.sql
fail=0

for f in "$PROD" "$BASE" "$EXTRAS"; do
    [ -f "$f" ] || { echo "missing $f" >&2; exit 1; }
done

check() {
    local label="$1" prod_n="$2" base_n="$3"
    if [ "$prod_n" -eq "$base_n" ]; then
        printf '  ok    %-22s %s\n' "$label" "$prod_n"
    else
        printf '  FAIL  %-22s prod=%s baseline=%s\n' "$label" "$prod_n" "$base_n"
        fail=1
    fi
}

echo "Baseline coverage vs production:"
check "tables"        "$(grep -c '^CREATE TABLE public\.'        "$PROD")"   "$(grep -c '^CREATE TABLE "'                "$BASE")"
check "policies"      "$(grep -c '^CREATE POLICY'                "$PROD")"   "$(grep -c '^CREATE POLICY'                 "$BASE")"
check "rls enabled"   "$(grep -c 'ENABLE ROW LEVEL SECURITY'     "$PROD")"   "$(grep -c 'ENABLE ROW LEVEL SECURITY'      "$BASE")"
check "views"         "$(grep -c '^CREATE VIEW'                  "$PROD")"   "$(grep -c '^CREATE VIEW'                   "$BASE")"
check "functions"     "$(grep -c '^CREATE FUNCTION'              "$PROD")"   "$(grep -c '^CREATE FUNCTION'               "$EXTRAS")"
check "triggers"      "$(grep -c '^CREATE TRIGGER'               "$PROD")"   "$(grep -c '^CREATE TRIGGER'                "$EXTRAS")"
check "matviews"      "$(grep -c '^CREATE MATERIALIZED VIEW'     "$PROD")"   "$(grep -c '^CREATE MATERIALIZED VIEW'      "$EXTRAS")"
# indexes are split: regular ones in the drizzle baseline, matview ones in extras
check "indexes"       "$(grep -cE '^CREATE (UNIQUE )?INDEX'      "$PROD")" \
                      "$(( $(grep -cE '^CREATE (UNIQUE )?INDEX' "$BASE") + $(grep -cE '^CREATE (UNIQUE )?INDEX' "$EXTRAS") ))"

# Name-level check for tables, which is where an omission hurts most.
comm -13 \
    <(grep -oE '^CREATE TABLE "[^"]+"' "$BASE" | sed 's/CREATE TABLE "//; s/"//' | sort -u) \
    <(grep -oE '^CREATE TABLE public\.[a-z_]+' "$PROD" | sed 's/CREATE TABLE public\.//' | sort -u) \
    > /tmp/missing_tables.txt
if [ -s /tmp/missing_tables.txt ]; then
    echo "  FAIL  tables present in production but absent from the baseline:"
    sed 's/^/          /' /tmp/missing_tables.txt
    fail=1
fi

echo
[ "$fail" -eq 0 ] && echo "PASS — baseline accounts for every production object." \
                  || echo "FAIL — baseline is incomplete." >&2
exit "$fail"
