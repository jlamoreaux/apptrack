#!/usr/bin/env bash
# Runs the behavioral checks for drizzle/0003_mcp_agent_access.sql against a
# throwaway local Postgres 16: the production-like base (see prod-base.sh),
# pre-existing wins and comp_entries rows, the drizzle migrations after the
# baseline through 0003, then mcp_agent_access_verify.sql. Run by hand; not
# run by Jest or CI.
#
# DESTRUCTIVE: drops the public, auth and extensions schemas and the anon,
# authenticated and service_role roles of the database it connects to. Never
# point it at Supabase. Connection comes from the standard PG* variables, e.g.
#   VERIFY_DB_THROWAWAY=1 PGHOST=/tmp/pgverify PGPORT=55445 PGUSER=postgres \
#     PGDATABASE=postgres db/tests/mcp_agent_access_verify.sh
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=db/tests/prod-base.sh
source "$HERE/prod-base.sh"

reset_to_prod_base

# Rows that exist before the migration, so the occurred_at backfill and the
# comp_entries.source default are exercised on real data.
"${PSQL[@]}" <<'SQL'
insert into auth.users (id) values ('00000000-0000-4000-8000-00000000000a');
insert into public.profiles (id, email) values ('00000000-0000-4000-8000-00000000000a', 'pre@example.com');
insert into public.wins (user_id, text, source, created_at) values
  ('00000000-0000-4000-8000-00000000000a', 'pre: late evening in New York', 'manual', '2025-03-01 23:30:00-05'),
  ('00000000-0000-4000-8000-00000000000a', 'pre: just after UTC midnight', 'recap', '2024-12-31 00:10:00+00');
insert into public.comp_entries (user_id, effective_date, base)
  values ('00000000-0000-4000-8000-00000000000a', '2025-01-01', 100000);
SQL

apply_migrations_through 0003_mcp_agent_access

"${PSQL[@]}" -f "$HERE/mcp_agent_access_verify.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //; s/^NOTICE:  //'
