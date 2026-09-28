# Sourced by the db/tests/*_verify.sh scripts. Rebuilds a throwaway local
# Postgres as production looks before the post-baseline drizzle migrations,
# then applies those migrations in journal order.
#
# The base is db/prod-truth/01_public_schema.sql (the production schema that
# drizzle/0000 + 0002_extras describe) on top of drizzle/0001_auth_schema.sql,
# plus stubs for what Supabase provides: the anon/authenticated/service_role
# roles, auth.uid()/auth.role()/auth.jwt(), uuid-ossp in the extensions schema,
# and Supabase's default privileges, so the migrations' revokes are exercised.
# drizzle/0000 itself is not replayable on an empty database (it is commented
# out, and several pulled indexes name operator classes that do not match
# their column types), so it is not used here.
#
# DESTRUCTIVE: drops the public, auth and extensions schemas and the anon,
# authenticated and service_role roles of the database it connects to. Never
# point it at Supabase. Connection comes from the standard PG* variables, and
# VERIFY_DB_THROWAWAY=1 must be set to confirm the target is a throwaway.

if [ "${VERIFY_DB_THROWAWAY:-}" != 1 ]; then
  echo "Set VERIFY_DB_THROWAWAY=1 to confirm the target database is a throwaway." >&2
  exit 2
fi
case "${PGHOST:-}" in
  /* | localhost | 127.0.0.1 | ::1) ;;
  *) echo "PGHOST must be a local socket directory or loopback host." >&2; exit 2 ;;
esac

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

reset_to_prod_base() {
  "${PSQL[@]}" -c "set client_min_messages = warning; drop schema if exists public cascade; drop schema if exists auth cascade; drop schema if exists extensions cascade;"
  local role
  for role in anon authenticated service_role; do
    if [ "$("${PSQL[@]}" -At -c "select count(*) from pg_roles where rolname = '$role'")" = 1 ]; then
      "${PSQL[@]}" -c "drop owned by $role; drop role $role;"
    fi
  done
  "${PSQL[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create extension "uuid-ossp" schema extensions;
SQL
  "${PSQL[@]}" -f "$ROOT/drizzle/0001_auth_schema.sql"
  "${PSQL[@]}" <<'SQL'
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create function auth.jwt() returns jsonb language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
SQL
  # The dump creates the public schema itself. transaction_timeout is a
  # Postgres 17 setting (production is 17); drop it so 16 can load the dump.
  grep -v '^SET transaction_timeout' "$ROOT/db/prod-truth/01_public_schema.sql" \
    | "${PSQL[@]}" --single-transaction >/dev/null
  # pg_dump creates materialized views WITH NO DATA; production's is populated,
  # and triggers refresh it CONCURRENTLY, which needs it populated.
  "${PSQL[@]}" <<'SQL'
refresh materialized view public.application_ai_analyses;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
SQL
}

# Applies the drizzle migrations after the baseline (journal idx >= 3), in
# journal order, up to and including the given tag, each in one transaction as
# drizzle-kit migrate would.
apply_migrations_through() {
  local target="$1" tag found=0
  for tag in $(python3 -c '
import json, sys
for e in json.load(open(sys.argv[1]))["entries"]:
    if e["idx"] >= 3:
        print(e["tag"])
' "$ROOT/drizzle/meta/_journal.json"); do
    "${PSQL[@]}" --single-transaction -f "$ROOT/drizzle/$tag.sql"
    echo "applied drizzle/$tag.sql"
    if [ "$tag" = "$target" ]; then found=1; break; fi
  done
  if [ "$found" != 1 ]; then
    echo "drizzle migration $target is not in the journal" >&2
    exit 1
  fi
}
