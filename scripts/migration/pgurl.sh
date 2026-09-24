# shellcheck shell=bash
# Emits the production Postgres URL on stdout. Never echo this value.
_pgurl() {
  local f v
  for f in .env .env.local; do
    [ -f "$f" ] || continue
    v=$(grep -m1 -E '^POSTGRES_URL_NON_POOLING=' "$f" | sed -E 's/^POSTGRES_URL_NON_POOLING=//; s/^"//; s/"$//')
    [ -n "$v" ] && { printf '%s' "$v"; return 0; }
  done
  return 1
}
PSQL17=/usr/local/opt/libpq/bin/psql
PGDUMP17=/usr/local/opt/libpq/bin/pg_dump
