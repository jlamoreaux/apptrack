#!/usr/bin/env bash
# Runs the migration 045 behavioral checks against a throwaway local
# Postgres 16: the Supabase stubs, the migration, 045_mcp_oauth_verify.sql,
# then the checks that need several sessions at once (parallel exchanges and
# refreshes, lock order against cleanup). Run by hand; not run by Jest or CI.
#
# DESTRUCTIVE: drops the public and auth schemas and the anon, authenticated
# and service_role roles of the database it connects to. Never point it at
# Supabase. Connection comes from the standard PG* variables, e.g.
#   VERIFY_045_THROWAWAY=1 PGHOST=/tmp/pg045 PGPORT=55445 PGUSER=postgres \
#     PGDATABASE=postgres schemas/tests/045_mcp_oauth_verify.sh
set -euo pipefail

if [ "${VERIFY_045_THROWAWAY:-}" != 1 ]; then
  echo "Set VERIFY_045_THROWAWAY=1 to confirm the target database is a throwaway." >&2
  exit 2
fi
case "${PGHOST:-}" in
  /* | localhost | 127.0.0.1 | ::1) ;;
  *) echo "PGHOST must be a local socket directory or loopback host." >&2; exit 2 ;;
esac

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT
failures=0

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; failures=$((failures + 1)); }
q() { "${PSQL[@]}" -At -c "$1"; }

# Reusable SQL expressions matching the helpers in the .sql file.
h() { echo "encode(sha256('$1'::bytea), 'hex')"; }
cid() { echo "('co_client_' || substr(md5('$1'), 1, 22))"; }
uid() { echo "md5('user:$1')::uuid"; }
CHAL="'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'"
RES="'https://careerotter.io/api/mcp'"
create_code() { # user client code_hash_seed
  q "select outcome from create_agent_oauth_code($(uid "$1"), $(cid "$2"), $(h "$3"), 'https://example.com/cb', $CHAL, array['wins:read'], null, $RES)"
}
add_client() { # seed created_at_offset
  q "insert into agent_oauth_clients (client_id, token_endpoint_auth_method, grant_types, client_name, redirect_uris, created_at)
     values ($(cid "$1"), 'none', array['authorization_code', 'refresh_token'], 'Client $1', array['https://example.com/cb'], now() - interval '${2:-0 hours}')"
}

# ── Reset, stubs, migration ────────────────────────────────────────────────
"${PSQL[@]}" -c "set client_min_messages = warning; drop schema if exists public cascade; drop schema if exists auth cascade; create schema public;"
for role in anon authenticated service_role; do
  if [ "$(q "select count(*) from pg_roles where rolname = '$role'")" = 1 ]; then
    "${PSQL[@]}" -c "drop owned by $role; drop role $role;"
  fi
done
"${PSQL[@]}" <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create table public.profiles (id uuid primary key references auth.users (id) on delete cascade);
grant usage on schema public to anon, authenticated, service_role;
-- Mirror Supabase's default privileges so the migration's revokes are exercised.
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
SQL
"${PSQL[@]}" -f "$ROOT/schemas/migrations/045_mcp_oauth.sql"
echo "migration applied"

# ── Single-session checks ──────────────────────────────────────────────────
"${PSQL[@]}" -f "$HERE/045_mcp_oauth_verify.sql" 2>&1 | sed 's/^psql:[^ ]* NOTICE:  //; s/^NOTICE:  //'

# ── Privileges at runtime ──────────────────────────────────────────────────
for role in anon authenticated; do
  for call in "select delete_expired_agent_oauth_rows()" "select revoke_all_agent_oauth_grants(gen_random_uuid())" \
              "select exchange_agent_oauth_code('x','y','z',null,false)"; do
    if out=$(q "set role $role; $call" 2>&1); then
      fail "$role could run: $call"
    elif grep -q "permission denied for function" <<<"$out"; then
      pass "privileges: $role denied: $call"
    else
      fail "unexpected error for $role: $out"
    fi
  done
  if out=$(q "set role $role; select count(*) from agent_oauth_grants" 2>&1) && [ "$out" = 0 ]; then
    pass "privileges: $role sees 0 grant rows (RLS, no policies)"
  elif grep -q "permission denied" <<<"$out"; then
    pass "privileges: $role denied on agent_oauth_grants"
  else
    fail "$role table access: $out"
  fi
done
[ "$(q "set role service_role; select outcome from rotate_agent_oauth_refresh('x','y','a','b')")" = invalid_grant ] \
  && pass "privileges: service_role can execute rotate_agent_oauth_refresh" \
  || fail "service_role cannot execute rotate_agent_oauth_refresh"

# ── J. 20 parallel exchanges of one code (set up by the .sql file) ──────────
for i in $(seq 1 20); do
  q "set role service_role; select outcome from exchange_agent_oauth_code($(h j1), $(cid c1), $(h "j-at-$i"), $(h "j-rt-$i"), true)" \
    >"$OUT/j.$i" 2>&1 &
done
wait
ok=$(cat "$OUT"/j.* | grep -cx ok || true)
reuse=$(cat "$OUT"/j.* | grep -cx code_reuse || true)
echo "J: parallel exchange outcomes: ok=$ok code_reuse=$reuse (of 20)"
[ "$ok" = 1 ] && [ "$reuse" = 19 ] \
  && pass "J: exactly one of 20 parallel exchanges succeeded; the other 19 are code_reuse" \
  || fail "J: expected 1 ok and 19 code_reuse"
[ "$(q "select count(*) = 1 and bool_and(revoke_reason = 'code_reuse') from agent_oauth_grants where client_id = $(cid c1) and user_id = $(uid u7)")" = t ] \
  && [ "$(q "select count(*) from agent_oauth_tokens t join agent_oauth_grants g on g.id = t.grant_id where g.client_id = $(cid c1) and g.user_id = $(uid u7)")" = 0 ] \
  && pass "J: one grant, revoked by the reuse, no tokens left" \
  || fail "J: grant state after the parallel exchange"

# ── K. 6 parallel refreshes of one token: 1 rotation + 5 grace reissues ─────
exchange_fresh() { # user client seed -> sets up code <seed> and tokens <seed>-at0/<seed>-rt0
  [ "$(create_code "$1" "$2" "$3")" = ok ]
  [ "$(q "select outcome from exchange_agent_oauth_code($(h "$3"), $(cid "$2"), $(h "$3-at0"), $(h "$3-rt0"), true)")" = ok ]
}
refresh() { # client presented_seed new_seed
  q "set role service_role; select outcome from rotate_agent_oauth_refresh($(h "$2"), $(cid "$1"), $(h "$3-at"), $(h "$3-rt"))"
}
exchange_fresh u7 c2 k
for i in $(seq 1 6); do refresh c2 k-rt0 "k$i" >"$OUT/k.$i" 2>&1 & done
wait
ok=$(cat "$OUT"/k.* | grep -cx ok || true)
echo "K: parallel refresh outcomes: ok=$ok (of 6)"
[ "$ok" = 6 ] && pass "K: 6 concurrent refreshes of one token all succeed (1 rotation + 5 grace reissues)" \
  || fail "K: expected 6 ok, got: $(cat "$OUT"/k.* | tr '\n' ' ')"
live=$(q "select substr(token_hash, 1, 64) from agent_oauth_tokens where rotated_from_hash = $(h k-rt0) and superseded_at is null")
[ "$(q "select count(*) || '/' || count(*) filter (where superseded_at is not null) from agent_oauth_tokens where rotated_from_hash = $(h k-rt0)")" = 6/5 ] \
  && [ "$(q "select count(*) from agent_oauth_tokens a where a.kind = 'access' and a.pair_id in (select pair_id from agent_oauth_tokens where rotated_from_hash = $(h k-rt0))")" = 1 ] \
  && [ "$(q "select count(*) from agent_oauth_tokens a join agent_oauth_tokens r on r.pair_id = a.pair_id and r.kind = 'refresh' where a.kind = 'access' and r.token_hash = '$live'")" = 1 ] \
  && [ "$(q "select grace_reissues from agent_oauth_tokens where token_hash = $(h k-rt0)")" = 5 ] \
  && pass "K: exactly one live successor with its access token; the other 5 superseded and their access tokens deleted" \
  || fail "K: successor state after the parallel refresh"
superseded_seed=$(for i in $(seq 1 6); do
  [ "$(q "select superseded_at is not null from agent_oauth_tokens where token_hash = $(h "k$i-rt")")" = t ] && echo "k$i" && break
done)
live_seed=$(for i in $(seq 1 6); do
  [ "$(q "select token_hash = '$live' from agent_oauth_tokens where token_hash = $(h "k$i-rt")")" = t ] && echo "k$i" && break
done)
[ "$(refresh c2 "$live_seed-rt" k7)" = ok ] \
  && pass "K: the live successor ($live_seed) rotates" || fail "K: the live successor did not rotate"
[ "$(refresh c2 "$superseded_seed-rt" k8)" = refresh_reuse ] \
  && [ "$(q "select revoke_reason from agent_oauth_grants where client_id = $(cid c2) and user_id = $(uid u7)")" = refresh_reuse ] \
  && [ "$(q "select count(*) from agent_oauth_tokens t join agent_oauth_grants g on g.id = t.grant_id where g.client_id = $(cid c2) and g.user_id = $(uid u7)")" = 0 ] \
  && pass "K: presenting a superseded successor ($superseded_seed) is reuse: grant revoked, tokens deleted" \
  || fail "K: superseded successor was not treated as reuse"

# ── K2. 7 parallel refreshes: 6 ok, then the 7th is past the reissue limit ──
exchange_fresh u7 c3 k2
for i in $(seq 1 7); do refresh c3 k2-rt0 "k2-$i" >"$OUT/k2.$i" 2>&1 & done
wait
ok=$(cat "$OUT"/k2.* | grep -cx ok || true)
reuse=$(cat "$OUT"/k2.* | grep -cx refresh_reuse || true)
echo "K2: parallel refresh outcomes: ok=$ok refresh_reuse=$reuse (of 7)"
[ "$ok" = 6 ] && [ "$reuse" = 1 ] \
  && [ "$(q "select revoke_reason from agent_oauth_grants where client_id = $(cid c3) and user_id = $(uid u7)")" = refresh_reuse ] \
  && pass "K2: 7 concurrent refreshes -> 6 ok, 1 refresh_reuse revoking the grant" \
  || fail "K2: expected 6 ok and 1 refresh_reuse"

# ── L. A first exchange in flight vs cleanup deleting its unused client ────
# A trigger stalls the exchange mid-way (after it has locked the code row)
# while cleanup tries to delete the client. Locking the client row first
# makes cleanup wait and then skip the client, instead of deadlocking.
add_client l1 '25 hours'
[ "$(create_code u4 l1 l1)" = ok ]
"${PSQL[@]}" <<SQL
create function public.verify_045_stall_grant () returns trigger language plpgsql as \$\$
begin
  if new.client_id = $(cid l1) then perform pg_sleep(2); end if;
  return new;
end \$\$;
create trigger verify_045_stall_grant before insert on public.agent_oauth_grants
  for each row execute function public.verify_045_stall_grant ();
SQL
q "set role service_role; select outcome from exchange_agent_oauth_code($(h l1), $(cid l1), $(h l1-at), $(h l1-rt), true)" >"$OUT/l.exchange" 2>&1 &
sleep 0.5
if cleanup=$(q "set role service_role; select clients_deleted from delete_expired_agent_oauth_rows()" 2>&1); then
  wait
  [ "$(cat "$OUT/l.exchange")" = ok ] \
    && [ "$(q "select first_authorized_at is not null from agent_oauth_clients where client_id = $(cid l1)")" = t ] \
    && pass "L: exchange and cleanup ran concurrently without deadlock; exchange ok, client kept (cleanup deleted $cleanup other client(s))" \
    || fail "L: exchange=$(cat "$OUT/l.exchange") client state wrong"
else
  wait
  fail "L: cleanup failed while an exchange was in flight: $cleanup (exchange: $(cat "$OUT/l.exchange"))"
fi
"${PSQL[@]}" -c "drop trigger verify_045_stall_grant on public.agent_oauth_grants; drop function public.verify_045_stall_grant ();"

# ── L2. Exchange while the client's deletion is in flight ──────────────────
add_client l2
[ "$(create_code u4 l2 l2)" = ok ]
q "begin; delete from agent_oauth_clients where client_id = $(cid l2); select pg_sleep(2); commit;" >/dev/null &
sleep 0.5
out=$(q "set role service_role; select outcome from exchange_agent_oauth_code($(h l2), $(cid l2), $(h l2-at), null, false)" 2>&1 || true)
wait
[ "$out" = invalid_grant ] \
  && pass "L2: exchange waits for a concurrent client delete, then returns invalid_grant" \
  || fail "L2: expected invalid_grant, got: $out"

# ── M. Code creation while the client's deletion is in flight ──────────────
add_client m1
q "begin; delete from agent_oauth_clients where client_id = $(cid m1); select pg_sleep(2); commit;" >/dev/null &
sleep 0.5
out=$(q "set role service_role; select outcome from create_agent_oauth_code($(uid u4), $(cid m1), $(h m1), 'https://example.com/cb', $CHAL, array['wins:read'], null, $RES)" 2>&1 || true)
wait
[ "$out" = invalid_client ] \
  && pass "M: code creation waits for a concurrent client delete, then returns invalid_client (not an FK error)" \
  || fail "M: expected invalid_client, got: $out"

# ── N. Idle revocation skips grants locked by a request in flight ──────────
add_client n1
add_client n2
q "insert into agent_oauth_grants (id, user_id, client_id, client_name, resource, scopes, expires_at, last_used_at) values
   ('00000000-0000-0000-0000-0000000000b1', $(uid u4), $(cid n1), 'n1', $RES, array['wins:read'], null, now() - interval '31 days'),
   ('00000000-0000-0000-0000-0000000000b2', $(uid u4), $(cid n2), 'n2', $RES, array['wins:read'], null, now() - interval '31 days')"
q "insert into agent_oauth_tokens (token_hash, grant_id, kind, pair_id, expires_at) values
   ($(h n1-at), '00000000-0000-0000-0000-0000000000b1', 'access', gen_random_uuid(), now() + interval '1 hour'),
   ($(h n2-at), '00000000-0000-0000-0000-0000000000b2', 'access', gen_random_uuid(), now() + interval '1 hour')"
q "begin; select 1 from agent_oauth_grants where id = '00000000-0000-0000-0000-0000000000b1' for update; select pg_sleep(2); commit;" >/dev/null &
sleep 0.5
start=$(date +%s%N)
idle=$(q "set role service_role; select idle_grants_revoked from delete_expired_agent_oauth_rows()")
elapsed_ms=$(( ($(date +%s%N) - start) / 1000000 ))
[ "$idle" = 1 ] && [ "$elapsed_ms" -lt 1000 ] \
  && [ "$(q "select revoked_at is null from agent_oauth_grants where id = '00000000-0000-0000-0000-0000000000b1'")" = t ] \
  && [ "$(q "select revoke_reason from agent_oauth_grants where id = '00000000-0000-0000-0000-0000000000b2'")" = idle ] \
  && [ "$(q "select count(*) from agent_oauth_tokens where grant_id = '00000000-0000-0000-0000-0000000000b2'")" = 0 ] \
  && [ "$(q "select count(*) from agent_oauth_tokens where grant_id = '00000000-0000-0000-0000-0000000000b1'")" = 1 ] \
  && pass "N: cleanup skipped the locked idle grant without waiting (${elapsed_ms} ms), revoked the other and deleted its tokens" \
  || fail "N: idle=$idle elapsed=${elapsed_ms}ms"
wait
[ "$(q "set role service_role; select idle_grants_revoked from delete_expired_agent_oauth_rows()")" = 1 ] \
  && [ "$(q "select revoke_reason from agent_oauth_grants where id = '00000000-0000-0000-0000-0000000000b1'")" = idle ] \
  && [ "$(q "select count(*) from agent_oauth_tokens where grant_id = '00000000-0000-0000-0000-0000000000b1'")" = 0 ] \
  && pass "N: the next run revokes the grant once it's unlocked" \
  || fail "N: the next run did not revoke the previously locked grant"

echo "multi-session failures: $failures"
[ "$failures" = 0 ]
