#!/usr/bin/env bash
# Regenerates db/prod-truth/ — the authoritative record of the production schema.
# The repo's schemas/, migrations/ and scripts/*.sql have drifted; this is the source of truth.
# Read-only. Safe to run any time. Re-run immediately before cutover.
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/migration/pgurl.sh
DB=$(_pgurl) || { echo "No POSTGRES_URL_NON_POOLING in .env/.env.local" >&2; exit 1; }
OUT=db/prod-truth
mkdir -p "$OUT"

# Server is PG17; the Homebrew postgresql@14 client refuses to dump it.
"$PGDUMP17" "$DB" --schema-only --schema=public --no-owner --no-privileges --no-comments -f "$OUT/01_public_schema.sql"
"$PGDUMP17" "$DB" --schema-only --schema=auth   --no-owner --no-privileges              -f "$OUT/02_auth_schema.sql"

q() { "$PSQL17" "$DB" -Atc "$1"; }
q "select p.proname||E'\n'||pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1;" > "$OUT/03_functions.txt"
q "select tgrelid::regclass::text||' | '||pg_get_triggerdef(oid) from pg_trigger where not tgisinternal order by 1;" > "$OUT/04_triggers.txt"
q "select schemaname||'.'||tablename||' | '||policyname||' | '||coalesce(replace(qual,E'\n',' '),'-') from pg_policies order by 1;" > "$OUT/05_policies.txt"
q "select schemaname||'.'||tablename||' | '||indexname||' | '||indexdef from pg_indexes where schemaname in ('public','auth') order by 1;" > "$OUT/06_indexes.txt"
q "select count(*)||' sequences in public' from pg_sequences where schemaname='public';" > "$OUT/07_sequences.txt"
q "select conrelid::regclass::text||' | '||conname||' | '||replace(pg_get_constraintdef(oid),E'\n',' ') from pg_constraint where connamespace='public'::regnamespace order by 1;" > "$OUT/08_constraints.txt"
# Trigger functions defined but wired to nothing - this is how the dormant
# handle_new_user_subscription bug was found.
q "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prorettype='trigger'::regtype and not exists (select 1 from pg_trigger t where t.tgfoid=p.oid and not t.tgisinternal) order by 1;" > "$OUT/09_orphaned_trigger_functions.txt"

echo "Wrote $OUT:"; wc -l "$OUT"/* | sed "s#$OUT/##"
