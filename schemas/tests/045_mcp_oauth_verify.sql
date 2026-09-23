-- schemas/tests/045_mcp_oauth_verify.sql
--
-- Behavioral checks for schemas/migrations/045_mcp_oauth.sql. Run by hand
-- against a throwaway local Postgres 16, never against Supabase. Not run by
-- Jest or CI.
--
-- schemas/tests/045_mcp_oauth_verify.sh does all of this, plus the checks that
-- need several sessions at once (parallel exchanges and refreshes, lock order
-- against cleanup). To run just this file, on an empty database:
--   1. Apply these stubs for what Supabase provides:
--        create role anon nologin;
--        create role authenticated nologin;
--        create role service_role nologin bypassrls;
--        create schema auth;
--        create table auth.users (id uuid primary key);
--        create table public.profiles (
--          id uuid primary key references auth.users (id) on delete cascade
--        );
--        grant usage on schema public to anon, authenticated, service_role;
--        alter default privileges in schema public
--          grant all on functions to anon, authenticated, service_role;
--        alter default privileges in schema public
--          grant all on tables to anon, authenticated, service_role;
--   2. psql -v ON_ERROR_STOP=1 -f schemas/migrations/045_mcp_oauth.sql
--   3. psql -v ON_ERROR_STOP=1 -f schemas/tests/045_mcp_oauth_verify.sql
-- Every check prints "PASS: ..."; the first failure stops the run with
-- "FAIL: ...".

\set QUIET on
\o /dev/null
set client_min_messages = notice;

create function pg_temp.h(t text) returns text language sql as $$ select encode(sha256(t::bytea), 'hex') $$;
create function pg_temp.cid(t text) returns text language sql as $$ select 'co_client_' || substr(md5(t), 1, 22) $$;
create function pg_temp.uid(t text) returns uuid language sql as $$ select md5('user:' || t)::uuid $$;
create function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
-- Challenge: 43 base64url chars.
\set chal '''E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'''
\set res '''https://careerotter.io/api/mcp'''

-- Fixtures: users u1..u9, clients c1..c14.
insert into auth.users select pg_temp.uid('u' || i) from generate_series(1, 9) i;
insert into public.profiles select id from auth.users;
insert into agent_oauth_clients (client_id, token_endpoint_auth_method, grant_types, client_name, redirect_uris)
  select pg_temp.cid('c' || i), 'none', array['authorization_code', 'refresh_token'], 'Client ' || i, array['https://example.com/cb']
  from generate_series(1, 14) i;

-- ═══ A. Privileges and RLS ═══
select pg_temp.check('A: ' || p.proname || ' not executable by anon/authenticated',
    not has_function_privilege('anon', p.oid, 'execute') and not has_function_privilege('authenticated', p.oid, 'execute'))
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like '%agent_oauth%';
select pg_temp.check('A: ' || p.proname || ' executable by service_role',
    has_function_privilege('service_role', p.oid, 'execute'))
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in (
    'create_agent_oauth_code', 'exchange_agent_oauth_code', 'rotate_agent_oauth_refresh', 'revoke_agent_oauth_grant',
    'revoke_all_agent_oauth_grants', 'revoke_agent_oauth_token', 'delete_expired_agent_oauth_rows');
select pg_temp.check('A: internal ' || p.proname || ' not executable by service_role',
    not has_function_privilege('service_role', p.oid, 'execute'))
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in (
    'agent_oauth_issue_tokens', 'agent_oauth_revoke_grant_row', 'agent_oauth_grant_cap_reached');
select pg_temp.check('A: all 10 security definer functions set search_path=public',
  (select count(*) = 10 from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like '%agent_oauth%'
     and p.prosecdef and p.proconfig @> array['search_path=public']));
select pg_temp.check('A: RLS on for ' || c.relname, c.relrowsecurity)
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relname like 'agent_oauth_%' and c.relkind = 'r';
select pg_temp.check('A: no policies on agent_oauth tables', not exists (select 1 from pg_policies where tablename like 'agent_oauth_%'));

-- ═══ B. Cap at code creation ═══
insert into agent_oauth_grants (user_id, client_id, client_name, resource, scopes)
  select pg_temp.uid('u1'), pg_temp.cid('c' || i), 'Client ' || i, :res, array['wins:read'] from generate_series(1, 10) i;
select pg_temp.check('B: 11th client at cap -> grant_cap',
  (select outcome = 'grant_cap' and expires_at is null from create_agent_oauth_code(pg_temp.uid('u1'), pg_temp.cid('c11'), pg_temp.h('b1'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
select pg_temp.check('B: no code stored on grant_cap', not exists (select 1 from agent_oauth_codes where code_hash = pg_temp.h('b1')));
select pg_temp.check('B: replacing an existing app at the cap -> ok',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u1'), pg_temp.cid('c1'), pg_temp.h('b2'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
select pg_temp.check('B: code expires in 5 minutes',
  (select expires_at - created_at = interval '5 minutes' from agent_oauth_codes where code_hash = pg_temp.h('b2')));
select pg_temp.check('B: unknown client -> invalid_client',
  (select outcome = 'invalid_client' from create_agent_oauth_code(pg_temp.uid('u1'), pg_temp.cid('nope'), pg_temp.h('b3'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
update agent_oauth_grants set expires_at = now() - interval '1 minute' where user_id = pg_temp.uid('u1') and client_id = pg_temp.cid('c2');
select pg_temp.check('B: an expired grant does not count toward the cap',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u1'), pg_temp.cid('c11'), pg_temp.h('b4'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
do $$ begin
  perform create_agent_oauth_code(pg_temp.uid('u9'), pg_temp.cid('c1'), pg_temp.h('b5'), 'https://example.com/cb',
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', array['comp:read'], null, 'https://careerotter.io/api/mcp');
  raise exception 'FAIL: comp code without expiry accepted';
exception when check_violation then raise notice 'PASS: B: comp scope without a grant expiry is rejected by CHECK';
end $$;
do $$ begin
  perform create_agent_oauth_code(pg_temp.uid('u9'), pg_temp.cid('c1'), pg_temp.h('b6'), 'https://example.com/cb',
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', array['wins:write'], null, 'https://careerotter.io/api/mcp');
  raise exception 'FAIL: write without read accepted';
exception when check_violation then raise notice 'PASS: B: write scope without its read scope is rejected by CHECK';
end $$;

select pg_temp.check('B: grant_expires_in of 365 days accepted',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u9'), pg_temp.cid('c1'), pg_temp.h('b7'), 'https://example.com/cb', :chal, array['comp:read'], interval '365 days', :res)));
do $$ begin
  perform create_agent_oauth_code(pg_temp.uid('u9'), pg_temp.cid('c1'), pg_temp.h('b8'), 'https://example.com/cb',
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', array['wins:read'], interval '366 days', 'https://careerotter.io/api/mcp');
  raise exception 'FAIL: grant_expires_in of 366 days accepted';
exception when check_violation then raise notice 'PASS: B: grant_expires_in over 365 days is rejected by CHECK';
end $$;
do $$ begin
  perform create_agent_oauth_code(pg_temp.uid('u9'), pg_temp.cid('c1'), pg_temp.h('b9'), 'https://example.com/cb',
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', array['wins:read'], interval '0', 'https://careerotter.io/api/mcp');
  raise exception 'FAIL: grant_expires_in of 0 accepted';
exception when check_violation then raise notice 'PASS: B: grant_expires_in of 0 is rejected by CHECK';
end $$;
do $$ begin
  perform create_agent_oauth_code(pg_temp.uid('u9'), pg_temp.cid('c1'), pg_temp.h('b10'), 'https://example.com/cb',
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', array['wins:read'], interval '-1 day', 'https://careerotter.io/api/mcp');
  raise exception 'FAIL: negative grant_expires_in accepted';
exception when check_violation then raise notice 'PASS: B: negative grant_expires_in is rejected by CHECK';
end $$;
-- Postgres 17 has an infinite interval, which the upper bound rejects; 16
-- can't even parse it.
do $$ begin
  perform create_agent_oauth_code(pg_temp.uid('u9'), pg_temp.cid('c1'), pg_temp.h('b11'), 'https://example.com/cb',
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', array['wins:read'], 'infinity'::interval, 'https://careerotter.io/api/mcp');
  raise exception 'FAIL: infinite grant_expires_in accepted';
exception when check_violation or invalid_datetime_format then raise notice 'PASS: B: infinite grant_expires_in is rejected';
end $$;
do $$ begin
  insert into agent_oauth_clients (client_id, token_endpoint_auth_method, grant_types, client_name, redirect_uris)
    values ('co_client_' || substr(md5('b-empty'), 1, 22), 'none', array['authorization_code'], 'Empty URI', array['https://example.com/cb', '']);
  raise exception 'FAIL: empty redirect URI accepted';
exception when check_violation then raise notice 'PASS: B: an empty redirect_uris entry is rejected by CHECK';
end $$;
select pg_temp.check('B: create_agent_oauth_code locks the client row for key share',
  (select prosrc ~ 'for key share' from pg_proc where proname = 'create_agent_oauth_code'));

-- ═══ C. Cap re-checked at exchange ═══
insert into agent_oauth_grants (user_id, client_id, client_name, resource, scopes)
  select pg_temp.uid('u2'), pg_temp.cid('c' || i), 'Client ' || i, :res, array['wins:read'] from generate_series(1, 9) i;
select pg_temp.check('C: code A at 9 grants -> ok',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u2'), pg_temp.cid('c11'), pg_temp.h('cA'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
select pg_temp.check('C: code B at 9 grants -> ok',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u2'), pg_temp.cid('c12'), pg_temp.h('cB'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
select pg_temp.check('C: exchange A -> ok',
  (select outcome = 'ok' from exchange_agent_oauth_code(pg_temp.h('cA'), pg_temp.cid('c11'), pg_temp.h('cA-at'), pg_temp.h('cA-rt'), true)));
select pg_temp.check('C: exchange B -> grant_cap',
  (select outcome = 'grant_cap' and grant_id is null from exchange_agent_oauth_code(pg_temp.h('cB'), pg_temp.cid('c12'), pg_temp.h('cB-at'), pg_temp.h('cB-rt'), true)));
select pg_temp.check('C: code B left unused, no grant or tokens created for c12',
  (select used_at is null from agent_oauth_codes where code_hash = pg_temp.h('cB'))
  and not exists (select 1 from agent_oauth_grants where user_id = pg_temp.uid('u2') and client_id = pg_temp.cid('c12'))
  and not exists (select 1 from agent_oauth_tokens where token_hash in (pg_temp.h('cB-at'), pg_temp.h('cB-rt'))));
select pg_temp.check('C: user has exactly 10 active grants',
  (select count(*) = 10 from agent_oauth_grants where user_id = pg_temp.uid('u2') and revoked_at is null));
-- Replacement at the cap goes through the exchange too.
select pg_temp.check('C: replacing c1 at the cap -> code ok',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u2'), pg_temp.cid('c1'), pg_temp.h('cR'), 'https://example.com/cb', :chal, array['wins:read', 'wins:write'], null, :res)));
select g.id as old_c1_grant from agent_oauth_grants g where user_id = pg_temp.uid('u2') and client_id = pg_temp.cid('c1') and revoked_at is null \gset
select pg_temp.check('C: replacing c1 at the cap -> exchange ok',
  (select outcome = 'ok' from exchange_agent_oauth_code(pg_temp.h('cR'), pg_temp.cid('c1'), pg_temp.h('cR-at'), null, false)));
select pg_temp.check('C: old c1 grant revoked with reason replaced',
  (select revoke_reason = 'replaced' from agent_oauth_grants where id = :'old_c1_grant'));

-- ═══ D. Exchange once; reuse revokes ═══
select pg_temp.check('D: create code',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u3'), pg_temp.cid('c13'), pg_temp.h('d1'), 'https://example.com/cb', :chal, array['wins:read', 'wins:write'], null, :res)));
select pg_temp.check('D: client first_authorized_at still null before the first exchange',
  (select first_authorized_at is null from agent_oauth_clients where client_id = pg_temp.cid('c13')));
select * from exchange_agent_oauth_code(pg_temp.h('d1'), pg_temp.cid('c13'), pg_temp.h('d1-at'), pg_temp.h('d1-rt'), true) \gset d_
select pg_temp.check('D: exchange -> ok, 86400 s access, refresh ~30 days, snapshot name and scopes',
  :'d_outcome' = 'ok' and :d_access_expires_in = 86400
  and :'d_refresh_expires_at'::timestamptz - now() between interval '29 days 23 hours' and interval '30 days'
  and :'d_client_name' = 'Client 13' and :'d_scopes'::text[] = array['wins:read', 'wins:write']);
select pg_temp.check('D: code marked used with grant_id; client first_authorized_at set; grant stores resource and no expiry',
  (select used_at is not null and grant_id = :'d_grant_id' from agent_oauth_codes where code_hash = pg_temp.h('d1'))
  and (select first_authorized_at is not null from agent_oauth_clients where client_id = pg_temp.cid('c13'))
  and (select resource = :res and expires_at is null and revoked_at is null from agent_oauth_grants where id = :'d_grant_id'));
select pg_temp.check('D: reuse -> code_reuse with the grant id',
  (select outcome = 'code_reuse' and grant_id = :'d_grant_id' from exchange_agent_oauth_code(pg_temp.h('d1'), pg_temp.cid('c13'), pg_temp.h('d1-at2'), pg_temp.h('d1-rt2'), true)));
select pg_temp.check('D: grant revoked (code_reuse) and its tokens deleted',
  (select revoke_reason = 'code_reuse' and revoked_at is not null from agent_oauth_grants where id = :'d_grant_id')
  and not exists (select 1 from agent_oauth_tokens where grant_id = :'d_grant_id'));
select pg_temp.check('D: second reuse still code_reuse, idempotent',
  (select outcome = 'code_reuse' from exchange_agent_oauth_code(pg_temp.h('d1'), pg_temp.cid('c13'), pg_temp.h('d1-at3'), null, false)));

-- ═══ E. Another client's code / expired code -> invalid_grant, nothing revoked ═══
select pg_temp.check('E: create code for c3',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u3'), pg_temp.cid('c3'), pg_temp.h('e1'), 'https://example.com/cb', :chal, array['wins:read'], interval '1 hour', :res)));
select pg_temp.check('E: exchange by another client -> invalid_grant',
  (select outcome = 'invalid_grant' and grant_id is null from exchange_agent_oauth_code(pg_temp.h('e1'), pg_temp.cid('c4'), pg_temp.h('e1-x'), null, false)));
select pg_temp.check('E: unknown code -> invalid_grant',
  (select outcome = 'invalid_grant' from exchange_agent_oauth_code(pg_temp.h('nope'), pg_temp.cid('c3'), pg_temp.h('e1-y'), null, false)));
select pg_temp.check('E: code still unused after the foreign attempt, no tokens stored',
  (select used_at is null from agent_oauth_codes where code_hash = pg_temp.h('e1'))
  and not exists (select 1 from agent_oauth_tokens where token_hash in (pg_temp.h('e1-x'), pg_temp.h('e1-y'))));
select * from exchange_agent_oauth_code(pg_temp.h('e1'), pg_temp.cid('c3'), pg_temp.h('e1-at'), pg_temp.h('e1-rt'), true) \gset e_
select pg_temp.check('E: rightful exchange -> ok; access and refresh capped at the 1-hour grant expiry',
  :'e_outcome' = 'ok' and :e_access_expires_in between 3599 and 3600
  and :'e_refresh_expires_at'::timestamptz = (select expires_at from agent_oauth_grants where id = :'e_grant_id'));
select pg_temp.check('E: create code for c5',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u3'), pg_temp.cid('c5'), pg_temp.h('e2'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
update agent_oauth_codes set expires_at = now() - interval '1 second' where code_hash = pg_temp.h('e2');
select (select outcome = 'invalid_grant' from exchange_agent_oauth_code(pg_temp.h('e2'), pg_temp.cid('c5'), pg_temp.h('e2-at'), null, false)) as split_1 \gset
select pg_temp.check('E: expired code -> invalid_grant, no grant created',
  :'split_1' = 't'
  and not exists (select 1 from agent_oauth_grants where user_id = pg_temp.uid('u3') and client_id = pg_temp.cid('c5')));
-- A used code replayed after it expired is still reuse, and revokes its grant.
update agent_oauth_codes set expires_at = now() - interval '1 second' where code_hash = pg_temp.h('e1');
select (select outcome = 'code_reuse' and grant_id = :'e_grant_id' from exchange_agent_oauth_code(pg_temp.h('e1'), pg_temp.cid('c3'), pg_temp.h('e1-z'), null, false)) as split_2 \gset
select pg_temp.check('E: expired used code -> code_reuse, grant revoked and its tokens deleted',
  :'split_2' = 't'
  and (select revoke_reason = 'code_reuse' from agent_oauth_grants where id = :'e_grant_id')
  and not exists (select 1 from agent_oauth_tokens where grant_id = :'e_grant_id'));
-- A grant lifetime under a minute can't produce a usable token.
select pg_temp.check('E: create code with a 30-second grant lifetime',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u3'), pg_temp.cid('c6'), pg_temp.h('e3'), 'https://example.com/cb', :chal, array['wins:read'], interval '30 seconds', :res)));
select (select outcome = 'invalid_grant' from exchange_agent_oauth_code(pg_temp.h('e3'), pg_temp.cid('c6'), pg_temp.h('e3-at'), pg_temp.h('e3-rt'), true)) as split_7 \gset
select pg_temp.check('E: grant expiring within 60 s -> invalid_grant, no grant or tokens, code unused',
  :'split_7' = 't'
  and not exists (select 1 from agent_oauth_grants where user_id = pg_temp.uid('u3') and client_id = pg_temp.cid('c6'))
  and not exists (select 1 from agent_oauth_tokens where token_hash in (pg_temp.h('e3-at'), pg_temp.h('e3-rt')))
  and (select used_at is null from agent_oauth_codes where code_hash = pg_temp.h('e3')));
select pg_temp.check('E: create code with a 61-second grant lifetime',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u3'), pg_temp.cid('c7'), pg_temp.h('e4'), 'https://example.com/cb', :chal, array['wins:read'], interval '61 seconds', :res)));
select pg_temp.check('E: grant with just over a minute left -> ok, expires_in > 0',
  (select outcome = 'ok' and access_expires_in between 60 and 61 from exchange_agent_oauth_code(pg_temp.h('e4'), pg_temp.cid('c7'), pg_temp.h('e4-at'), pg_temp.h('e4-rt'), true)));
select pg_temp.check('E: exchange with an unknown client (e.g. deleted) -> invalid_grant, code untouched',
  (select outcome = 'invalid_grant' from exchange_agent_oauth_code(pg_temp.h('b2'), pg_temp.cid('gone'), pg_temp.h('e5-at'), null, false))
  and (select used_at is null from agent_oauth_codes where code_hash = pg_temp.h('b2')));

-- ═══ F. Refresh omitted when not requested ═══
select pg_temp.check('F: create code',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u4'), pg_temp.cid('c1'), pg_temp.h('f1'), 'https://example.com/cb', :chal, array['career:read'], null, :res)));
select outcome as f_outcome, grant_id as f_grant_id, (refresh_expires_at is null) as f_no_refresh
  from exchange_agent_oauth_code(pg_temp.h('f1'), pg_temp.cid('c1'), pg_temp.h('f1-at'), pg_temp.h('f1-rt'), false) \gset
select pg_temp.check('F: exchange without refresh -> ok, refresh_expires_at null, only an access token stored',
  :'f_outcome' = 'ok' and :'f_no_refresh' = 't'
  and (select array_agg(kind) = array['access'] from agent_oauth_tokens where grant_id = :'f_grant_id')
  and not exists (select 1 from agent_oauth_tokens where token_hash = pg_temp.h('f1-rt')));

-- ═══ G. Refresh rotation ═══
select pg_temp.check('G: create code',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u5'), pg_temp.cid('c1'), pg_temp.h('g1'), 'https://example.com/cb', :chal, array['wins:read', 'wins:write'], null, :res)));
select * from exchange_agent_oauth_code(pg_temp.h('g1'), pg_temp.cid('c1'), pg_temp.h('g-at0'), pg_temp.h('g-rt0'), true) \gset g_
select (select outcome = 'invalid_grant' from rotate_agent_oauth_refresh(pg_temp.h('g-rt0'), pg_temp.cid('c2'), pg_temp.h('gx-at'), pg_temp.h('gx-rt'))) as split_3 \gset
select pg_temp.check('G: refresh from another client -> invalid_grant, nothing consumed or revoked',
  :'split_3' = 't'
  and (select consumed_at is null from agent_oauth_tokens where token_hash = pg_temp.h('g-rt0'))
  and (select revoked_at is null from agent_oauth_grants where id = :'g_grant_id'));
select pg_temp.check('G: an access token presented as refresh -> invalid_grant',
  (select outcome = 'invalid_grant' from rotate_agent_oauth_refresh(pg_temp.h('g-at0'), pg_temp.cid('c1'), pg_temp.h('gy-at'), pg_temp.h('gy-rt'))));
select pg_temp.check('G: unknown refresh token -> invalid_grant',
  (select outcome = 'invalid_grant' from rotate_agent_oauth_refresh(pg_temp.h('nope'), pg_temp.cid('c1'), pg_temp.h('gz-at'), pg_temp.h('gz-rt'))));
-- An expired access token for this grant, which rotation should delete.
update agent_oauth_grants set last_used_at = now() - interval '1 day' where id = :'g_grant_id';
insert into agent_oauth_tokens (token_hash, grant_id, kind, pair_id, expires_at) values (pg_temp.h('g-at-old'), :'g_grant_id', 'access', gen_random_uuid(), now() - interval '1 minute');
select pg_temp.check('G: rotation -> ok, 86400 s access, ~30 day refresh',
  (select outcome = 'ok' and grant_id = :'g_grant_id' and access_expires_in = 86400
     and scopes = array['wins:read', 'wins:write']
     and refresh_expires_at - now() between interval '29 days 23 hours' and interval '30 days'
   from rotate_agent_oauth_refresh(pg_temp.h('g-rt0'), pg_temp.cid('c1'), pg_temp.h('g-at1'), pg_temp.h('g-rt1'))));
select pg_temp.check('G: exchange pair shares a pair_id; its refresh token has no parent',
  (select count(distinct pair_id) = 1 and count(*) = 2 and bool_and(rotated_from_hash is null)
     from agent_oauth_tokens where token_hash in (pg_temp.h('g-at0'), pg_temp.h('g-rt0'))));
select pg_temp.check('G: rotated pair shares a new pair_id; its refresh token points at the presented one',
  (select count(distinct pair_id) = 1 from agent_oauth_tokens where token_hash in (pg_temp.h('g-at1'), pg_temp.h('g-rt1')))
  and (select pair_id from agent_oauth_tokens where token_hash = pg_temp.h('g-at1'))
      <> (select pair_id from agent_oauth_tokens where token_hash = pg_temp.h('g-at0'))
  and (select rotated_from_hash = pg_temp.h('g-rt0') from agent_oauth_tokens where token_hash = pg_temp.h('g-rt1'))
  and (select rotated_from_hash is null from agent_oauth_tokens where token_hash = pg_temp.h('g-at1')));
select pg_temp.check('G: presented token consumed, new pair stored, expired access token deleted, last_used_at bumped',
  (select consumed_at is not null from agent_oauth_tokens where token_hash = pg_temp.h('g-rt0'))
  and (select count(*) = 2 from agent_oauth_tokens where token_hash in (pg_temp.h('g-at1'), pg_temp.h('g-rt1')))
  and not exists (select 1 from agent_oauth_tokens where token_hash = pg_temp.h('g-at-old'))
  and exists (select 1 from agent_oauth_tokens where token_hash = pg_temp.h('g-at0'))
  and (select last_used_at > now() - interval '1 minute' from agent_oauth_grants where id = :'g_grant_id'));
select pg_temp.check('G: grace reissue ' || i || '/5 within 60 s -> ok',
  (select outcome = 'ok' from rotate_agent_oauth_refresh(pg_temp.h('g-rt0'), pg_temp.cid('c1'), pg_temp.h('g-gat' || i), pg_temp.h('g-grt' || i))))
  from generate_series(1, 5) i;
select pg_temp.check('G: grace_reissues = 5 and the grant is still active',
  (select grace_reissues = 5 from agent_oauth_tokens where token_hash = pg_temp.h('g-rt0'))
  and (select revoked_at is null from agent_oauth_grants where id = :'g_grant_id'));
select pg_temp.check('G: only the last successor is live; the 5 earlier ones are superseded and their access tokens deleted',
  (select count(*) = 6 and count(*) filter (where superseded_at is null) = 1
     and bool_and(superseded_at is null) filter (where token_hash = pg_temp.h('g-grt5'))
     and bool_and(consumed_at is null)
   from agent_oauth_tokens where rotated_from_hash = pg_temp.h('g-rt0'))
  and not exists (select 1 from agent_oauth_tokens where token_hash in
    (pg_temp.h('g-at1'), pg_temp.h('g-gat1'), pg_temp.h('g-gat2'), pg_temp.h('g-gat3'), pg_temp.h('g-gat4')))
  and exists (select 1 from agent_oauth_tokens where token_hash = pg_temp.h('g-gat5'))
  and exists (select 1 from agent_oauth_tokens where token_hash = pg_temp.h('g-at0')));
select pg_temp.check('G: 6th reuse within the window -> refresh_reuse',
  (select outcome = 'refresh_reuse' and grant_id = :'g_grant_id' from rotate_agent_oauth_refresh(pg_temp.h('g-rt0'), pg_temp.cid('c1'), pg_temp.h('g-gat6'), pg_temp.h('g-grt6'))));
select pg_temp.check('G: grant revoked (refresh_reuse), all its tokens deleted',
  (select revoke_reason = 'refresh_reuse' from agent_oauth_grants where id = :'g_grant_id')
  and not exists (select 1 from agent_oauth_tokens where grant_id = :'g_grant_id'));
select pg_temp.check('G: the rotated-in refresh token no longer works after revocation',
  (select outcome = 'invalid_grant' from rotate_agent_oauth_refresh(pg_temp.h('g-grt5'), pg_temp.cid('c1'), pg_temp.h('g-at9'), pg_temp.h('g-rt9'))));

-- Reuse after the window.
select pg_temp.check('G2: create code',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u5'), pg_temp.cid('c2'), pg_temp.h('g2'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
select * from exchange_agent_oauth_code(pg_temp.h('g2'), pg_temp.cid('c2'), pg_temp.h('g2-at0'), pg_temp.h('g2-rt0'), true) \gset g2_
select pg_temp.check('G2: rotate -> ok',
  (select outcome = 'ok' from rotate_agent_oauth_refresh(pg_temp.h('g2-rt0'), pg_temp.cid('c2'), pg_temp.h('g2-at1'), pg_temp.h('g2-rt1'))));
update agent_oauth_tokens set consumed_at = now() - interval '61 seconds' where token_hash = pg_temp.h('g2-rt0');
select pg_temp.check('G2: reuse 61 s after consumption -> refresh_reuse',
  (select outcome = 'refresh_reuse' from rotate_agent_oauth_refresh(pg_temp.h('g2-rt0'), pg_temp.cid('c2'), pg_temp.h('g2-at2'), pg_temp.h('g2-rt2'))));
select pg_temp.check('G2: grant revoked and tokens deleted',
  (select revoke_reason = 'refresh_reuse' from agent_oauth_grants where id = :'g2_grant_id')
  and not exists (select 1 from agent_oauth_tokens where grant_id = :'g2_grant_id'));

-- Expired refresh token, expired grant.
select pg_temp.check('G3: create code',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u5'), pg_temp.cid('c3'), pg_temp.h('g3'), 'https://example.com/cb', :chal, array['wins:read'], interval '7 days', :res)));
select * from exchange_agent_oauth_code(pg_temp.h('g3'), pg_temp.cid('c3'), pg_temp.h('g3-at0'), pg_temp.h('g3-rt0'), true) \gset g3_
update agent_oauth_tokens set expires_at = now() - interval '1 second' where token_hash = pg_temp.h('g3-rt0');
select (select outcome = 'invalid_grant' from rotate_agent_oauth_refresh(pg_temp.h('g3-rt0'), pg_temp.cid('c3'), pg_temp.h('g3-at1'), pg_temp.h('g3-rt1'))) as split_4 \gset
select pg_temp.check('G3: expired refresh token -> invalid_grant, grant not revoked, token not consumed',
  :'split_4' = 't'
  and (select revoked_at is null from agent_oauth_grants where id = :'g3_grant_id')
  and (select consumed_at is null from agent_oauth_tokens where token_hash = pg_temp.h('g3-rt0')));
update agent_oauth_tokens set expires_at = now() + interval '1 day' where token_hash = pg_temp.h('g3-rt0');
update agent_oauth_grants set expires_at = now() - interval '1 second' where id = :'g3_grant_id';
select pg_temp.check('G3: expired grant -> invalid_grant',
  (select outcome = 'invalid_grant' from rotate_agent_oauth_refresh(pg_temp.h('g3-rt0'), pg_temp.cid('c3'), pg_temp.h('g3-at1'), pg_temp.h('g3-rt1'))));
update agent_oauth_grants set expires_at = now() + interval '2 hours' where id = :'g3_grant_id';
select pg_temp.check('G3: rotation near grant expiry caps both tokens at the grant expiry',
  (select outcome = 'ok' and access_expires_in between 7199 and 7200
     and refresh_expires_at = (select expires_at from agent_oauth_grants where id = :'g3_grant_id')
   from rotate_agent_oauth_refresh(pg_temp.h('g3-rt0'), pg_temp.cid('c3'), pg_temp.h('g3-at1'), pg_temp.h('g3-rt1'))));
update agent_oauth_grants set expires_at = now() + interval '30 seconds' where id = :'g3_grant_id';
select (select outcome = 'invalid_grant' from rotate_agent_oauth_refresh(pg_temp.h('g3-rt1'), pg_temp.cid('c3'), pg_temp.h('g3-at2'), pg_temp.h('g3-rt2'))) as split_8 \gset
select pg_temp.check('G3: grant expiring within 60 s -> invalid_grant, token not consumed, grant not revoked, nothing issued',
  :'split_8' = 't'
  and (select consumed_at is null from agent_oauth_tokens where token_hash = pg_temp.h('g3-rt1'))
  and (select revoked_at is null from agent_oauth_grants where id = :'g3_grant_id')
  and not exists (select 1 from agent_oauth_tokens where token_hash in (pg_temp.h('g3-at2'), pg_temp.h('g3-rt2'))));
update agent_oauth_grants set expires_at = now() + interval '61 seconds' where id = :'g3_grant_id';
select pg_temp.check('G3: grant with just over a minute left -> ok, expires_in > 0',
  (select outcome = 'ok' and access_expires_in between 60 and 61
   from rotate_agent_oauth_refresh(pg_temp.h('g3-rt1'), pg_temp.cid('c3'), pg_temp.h('g3-at2'), pg_temp.h('g3-rt2'))));
do $$ begin
  perform rotate_agent_oauth_refresh(encode(sha256('g3-rt2'::bytea), 'hex'), 'co_client_' || substr(md5('c3'), 1, 22), null, encode(sha256('g3-rt3'::bytea), 'hex'));
  raise exception 'FAIL: rotation with a null access hash accepted';
exception when raise_exception then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'PASS: G3: rotation with a null new access hash raises';
end $$;
do $$ begin
  perform rotate_agent_oauth_refresh(encode(sha256('g3-rt2'::bytea), 'hex'), 'co_client_' || substr(md5('c3'), 1, 22), encode(sha256('g3-at3'::bytea), 'hex'), null);
  raise exception 'FAIL: rotation with a null refresh hash accepted';
exception when raise_exception then
  if sqlerrm like 'FAIL:%' then raise; end if;
  raise notice 'PASS: G3: rotation with a null new refresh hash raises';
end $$;
select pg_temp.check('G3: the failed calls consumed nothing',
  (select consumed_at is null from agent_oauth_tokens where token_hash = pg_temp.h('g3-rt2')));

-- ═══ G3b. A consumed token that expired inside the grace window gets no reissue ═══
select pg_temp.check('G3b: create code',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u4'), pg_temp.cid('c10'), pg_temp.h('g3b'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
select * from exchange_agent_oauth_code(pg_temp.h('g3b'), pg_temp.cid('c10'), pg_temp.h('g3b-at0'), pg_temp.h('g3b-rt0'), true) \gset g3b_
select pg_temp.check('G3b: rotate -> ok',
  (select outcome = 'ok' from rotate_agent_oauth_refresh(pg_temp.h('g3b-rt0'), pg_temp.cid('c10'), pg_temp.h('g3b-at1'), pg_temp.h('g3b-rt1'))));
update agent_oauth_tokens set expires_at = now() - interval '1 second' where token_hash = pg_temp.h('g3b-rt0');
select (select outcome = 'invalid_grant' from rotate_agent_oauth_refresh(pg_temp.h('g3b-rt0'), pg_temp.cid('c10'), pg_temp.h('g3b-at2'), pg_temp.h('g3b-rt2'))) as split_9 \gset
select pg_temp.check('G3b: expired consumed token inside the window -> invalid_grant, no reissue, nothing superseded, grant active',
  :'split_9' = 't'
  and (select grace_reissues = 0 from agent_oauth_tokens where token_hash = pg_temp.h('g3b-rt0'))
  and not exists (select 1 from agent_oauth_tokens where token_hash in (pg_temp.h('g3b-at2'), pg_temp.h('g3b-rt2')))
  and (select superseded_at is null from agent_oauth_tokens where token_hash = pg_temp.h('g3b-rt1'))
  and exists (select 1 from agent_oauth_tokens where token_hash = pg_temp.h('g3b-at1'))
  and (select revoked_at is null from agent_oauth_grants where id = :'g3b_grant_id'));
select pg_temp.check('G3b: the live successor still rotates',
  (select outcome = 'ok' from rotate_agent_oauth_refresh(pg_temp.h('g3b-rt1'), pg_temp.cid('c10'), pg_temp.h('g3b-at3'), pg_temp.h('g3b-rt3'))));
select pg_temp.check('G3b: an expired consumed token whose successor was used is still reuse',
  (select outcome = 'refresh_reuse' and grant_id = :'g3b_grant_id'
   from rotate_agent_oauth_refresh(pg_temp.h('g3b-rt0'), pg_temp.cid('c10'), pg_temp.h('g3b-at4'), pg_temp.h('g3b-rt4'))));

-- ═══ G4. Racing grace reissue supersedes the earlier successor; presenting it is reuse ═══
select pg_temp.check('G4: create code',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u5'), pg_temp.cid('c4'), pg_temp.h('g4'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
select * from exchange_agent_oauth_code(pg_temp.h('g4'), pg_temp.cid('c4'), pg_temp.h('g4-at0'), pg_temp.h('g4-rt0'), true) \gset g4_
select pg_temp.check('G4: first refresh of rt0 -> ok (rt1)',
  (select outcome = 'ok' from rotate_agent_oauth_refresh(pg_temp.h('g4-rt0'), pg_temp.cid('c4'), pg_temp.h('g4-at1'), pg_temp.h('g4-rt1'))));
select pg_temp.check('G4: racing refresh of rt0 in the window -> ok (rt2)',
  (select outcome = 'ok' from rotate_agent_oauth_refresh(pg_temp.h('g4-rt0'), pg_temp.cid('c4'), pg_temp.h('g4-at2'), pg_temp.h('g4-rt2'))));
select pg_temp.check('G4: rt1 superseded and its access token deleted; rt2 and its access token live and linked',
  (select superseded_at is not null and consumed_at is null from agent_oauth_tokens where token_hash = pg_temp.h('g4-rt1'))
  and not exists (select 1 from agent_oauth_tokens where token_hash = pg_temp.h('g4-at1'))
  and (select superseded_at is null and rotated_from_hash = pg_temp.h('g4-rt0') from agent_oauth_tokens where token_hash = pg_temp.h('g4-rt2'))
  and (select count(distinct pair_id) = 1 and count(*) = 2 from agent_oauth_tokens where token_hash in (pg_temp.h('g4-at2'), pg_temp.h('g4-rt2')))
  and (select grace_reissues = 1 from agent_oauth_tokens where token_hash = pg_temp.h('g4-rt0')));
select pg_temp.check('G4: presenting the superseded rt1 -> refresh_reuse',
  (select outcome = 'refresh_reuse' and grant_id = :'g4_grant_id' from rotate_agent_oauth_refresh(pg_temp.h('g4-rt1'), pg_temp.cid('c4'), pg_temp.h('g4-at3'), pg_temp.h('g4-rt3'))));
select pg_temp.check('G4: grant revoked (refresh_reuse), all its tokens deleted, rt2 no longer works',
  (select revoke_reason = 'refresh_reuse' from agent_oauth_grants where id = :'g4_grant_id')
  and not exists (select 1 from agent_oauth_tokens where grant_id = :'g4_grant_id')
  and (select outcome = 'invalid_grant' from rotate_agent_oauth_refresh(pg_temp.h('g4-rt2'), pg_temp.cid('c4'), pg_temp.h('g4-at4'), pg_temp.h('g4-rt4'))));

-- ═══ G5. The last successor works; afterwards the parent can't be replayed ═══
select pg_temp.check('G5: create code',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u5'), pg_temp.cid('c5'), pg_temp.h('g5'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
select * from exchange_agent_oauth_code(pg_temp.h('g5'), pg_temp.cid('c5'), pg_temp.h('g5-at0'), pg_temp.h('g5-rt0'), true) \gset g5_
select pg_temp.check('G5: rt0 -> rt1, then a racing rt0 -> rt2',
  (select outcome = 'ok' from rotate_agent_oauth_refresh(pg_temp.h('g5-rt0'), pg_temp.cid('c5'), pg_temp.h('g5-at1'), pg_temp.h('g5-rt1')))
  and (select outcome = 'ok' from rotate_agent_oauth_refresh(pg_temp.h('g5-rt0'), pg_temp.cid('c5'), pg_temp.h('g5-at2'), pg_temp.h('g5-rt2'))));
select pg_temp.check('G5: the last successor rt2 rotates -> ok (rt3)',
  (select outcome = 'ok' from rotate_agent_oauth_refresh(pg_temp.h('g5-rt2'), pg_temp.cid('c5'), pg_temp.h('g5-at3'), pg_temp.h('g5-rt3'))));
select pg_temp.check('G5: rt0 again, inside the window but with a consumed successor -> refresh_reuse',
  (select outcome = 'refresh_reuse' from rotate_agent_oauth_refresh(pg_temp.h('g5-rt0'), pg_temp.cid('c5'), pg_temp.h('g5-at4'), pg_temp.h('g5-rt4'))));
select pg_temp.check('G5: grant revoked and its tokens deleted',
  (select revoke_reason = 'refresh_reuse' from agent_oauth_grants where id = :'g5_grant_id')
  and not exists (select 1 from agent_oauth_tokens where grant_id = :'g5_grant_id'));

-- ═══ G6. A thief replaying a token the client has already moved past ═══
select pg_temp.check('G6: create code',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u5'), pg_temp.cid('c6'), pg_temp.h('g6'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
select * from exchange_agent_oauth_code(pg_temp.h('g6'), pg_temp.cid('c6'), pg_temp.h('g6-at0'), pg_temp.h('g6-rt0'), true) \gset g6_
select pg_temp.check('G6: client rotates rt0 -> rt1 -> rt2',
  (select outcome = 'ok' from rotate_agent_oauth_refresh(pg_temp.h('g6-rt0'), pg_temp.cid('c6'), pg_temp.h('g6-at1'), pg_temp.h('g6-rt1')))
  and (select outcome = 'ok' from rotate_agent_oauth_refresh(pg_temp.h('g6-rt1'), pg_temp.cid('c6'), pg_temp.h('g6-at2'), pg_temp.h('g6-rt2'))));
select (select outcome = 'refresh_reuse' from rotate_agent_oauth_refresh(pg_temp.h('g6-rt0'), pg_temp.cid('c6'), pg_temp.h('g6-at9'), pg_temp.h('g6-rt9'))) as split_9 \gset
select pg_temp.check('G6: replaying rt0 within 60 s -> refresh_reuse (its successor rt1 was consumed), grant revoked',
  :'split_9' = 't'
  and (select revoke_reason = 'refresh_reuse' from agent_oauth_grants where id = :'g6_grant_id')
  and not exists (select 1 from agent_oauth_tokens where grant_id = :'g6_grant_id'));

-- ═══ G7. Token CHECKs ═══
do $$ begin
  insert into agent_oauth_tokens (token_hash, grant_id, kind, pair_id, rotated_from_hash, expires_at)
    select encode(sha256('g7-a'::bytea), 'hex'), id, 'access', gen_random_uuid(), encode(sha256('x'::bytea), 'hex'), now() + interval '1 hour'
    from agent_oauth_grants limit 1;
  raise exception 'FAIL: access token with rotated_from_hash accepted';
exception when check_violation then raise notice 'PASS: G7: an access token with rotated_from_hash is rejected by CHECK';
end $$;
do $$ begin
  insert into agent_oauth_tokens (token_hash, grant_id, kind, pair_id, superseded_at, expires_at)
    select encode(sha256('g7-b'::bytea), 'hex'), id, 'access', gen_random_uuid(), now(), now() + interval '1 hour'
    from agent_oauth_grants limit 1;
  raise exception 'FAIL: superseded access token accepted';
exception when check_violation then raise notice 'PASS: G7: a superseded access token is rejected by CHECK';
end $$;
do $$ begin
  insert into agent_oauth_tokens (token_hash, grant_id, kind, pair_id, consumed_at, superseded_at, expires_at)
    select encode(sha256('g7-c'::bytea), 'hex'), id, 'refresh', gen_random_uuid(), now(), now(), now() + interval '1 hour'
    from agent_oauth_grants limit 1;
  raise exception 'FAIL: consumed and superseded refresh token accepted';
exception when check_violation then raise notice 'PASS: G7: a refresh token both consumed and superseded is rejected by CHECK';
end $$;
do $$ begin
  insert into agent_oauth_tokens (token_hash, grant_id, kind, expires_at)
    select encode(sha256('g7-d'::bytea), 'hex'), id, 'access', now() + interval '1 hour'
    from agent_oauth_grants limit 1;
  raise exception 'FAIL: token without pair_id accepted';
exception when not_null_violation then raise notice 'PASS: G7: a token without pair_id is rejected';
end $$;

-- ═══ H. Revoke, revoke-all, revoke-token ═══
select pg_temp.check('H: create + exchange two grants for u6',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u6'), pg_temp.cid('c1'), pg_temp.h('h1'), 'https://example.com/cb', :chal, array['wins:read'], null, :res))
  and (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u6'), pg_temp.cid('c2'), pg_temp.h('h2'), 'https://example.com/cb', :chal, array['wins:read'], null, :res))
  and (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u6'), pg_temp.cid('c3'), pg_temp.h('h3'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
select grant_id as h1_grant from exchange_agent_oauth_code(pg_temp.h('h1'), pg_temp.cid('c1'), pg_temp.h('h1-at'), pg_temp.h('h1-rt'), true) \gset
select grant_id as h2_grant from exchange_agent_oauth_code(pg_temp.h('h2'), pg_temp.cid('c2'), pg_temp.h('h2-at'), pg_temp.h('h2-rt'), true) \gset
select grant_id as h3_grant from exchange_agent_oauth_code(pg_temp.h('h3'), pg_temp.cid('c3'), pg_temp.h('h3-at'), pg_temp.h('h3-rt'), true) \gset
select (select outcome = 'not_found' and grant_id is null from revoke_agent_oauth_grant(:'h1_grant', pg_temp.uid('u7'), 'user')) as split_5 \gset
select pg_temp.check('H: revoke by another user -> not_found, grant untouched',
  :'split_5' = 't'
  and (select revoked_at is null from agent_oauth_grants where id = :'h1_grant'));
select pg_temp.check('H: revoke unknown id -> not_found',
  (select outcome = 'not_found' and grant_id is null from revoke_agent_oauth_grant(gen_random_uuid(), pg_temp.uid('u6'), 'user')));
select outcome as h_r1, grant_id as h_r1_grant from revoke_agent_oauth_grant(:'h1_grant', pg_temp.uid('u6'), 'user') \gset
select pg_temp.check('H: revoke -> revoked with the grant id, reason user, tokens deleted',
  :'h_r1' = 'revoked' and :'h_r1_grant' = :'h1_grant'
  and (select revoke_reason = 'user' from agent_oauth_grants where id = :'h1_grant')
  and not exists (select 1 from agent_oauth_tokens where grant_id = :'h1_grant'));
select revoked_at as h1_revoked_at from agent_oauth_grants where id = :'h1_grant' \gset
select outcome as h_r2, grant_id as h_r2_grant from revoke_agent_oauth_grant(:'h1_grant', pg_temp.uid('u6'), 'user') \gset
select pg_temp.check('H: revoke again -> already_revoked with the grant id, revoked_at and reason unchanged',
  :'h_r2' = 'already_revoked' and :'h_r2_grant' = :'h1_grant'
  and (select revoked_at = :'h1_revoked_at' and revoke_reason = 'user' from agent_oauth_grants where id = :'h1_grant'));
select (select outcome = 'not_found' and grant_id is null from revoke_agent_oauth_token(pg_temp.h('h2-rt'), pg_temp.cid('c9'))) as split_6 \gset
select pg_temp.check('H: revoke_agent_oauth_token by another client -> not_found, grant untouched',
  :'split_6' = 't'
  and (select revoked_at is null from agent_oauth_grants where id = :'h2_grant'));
select outcome = 'revoked' and grant_id = :'h2_grant' as h_t1 from revoke_agent_oauth_token(pg_temp.h('h2-at'), pg_temp.cid('c2')) \gset
select pg_temp.check('H: revoke_agent_oauth_token (access token) by its client -> revoked (reason client), tokens deleted',
  :'h_t1' = 't'
  and (select revoke_reason = 'client' from agent_oauth_grants where id = :'h2_grant')
  and not exists (select 1 from agent_oauth_tokens where grant_id = :'h2_grant'));
select pg_temp.check('H: revoke_agent_oauth_token again -> not_found (tokens gone)',
  (select outcome = 'not_found' from revoke_agent_oauth_token(pg_temp.h('h2-rt'), pg_temp.cid('c2'))));
select revoke_all_agent_oauth_grants(pg_temp.uid('u6')) as h_all1 \gset
select pg_temp.check('H: revoke_all -> 1 (only h3 still active), reason user_all, no tokens left',
  :h_all1 = 1
  and (select revoke_reason = 'user_all' from agent_oauth_grants where id = :'h3_grant')
  and (select revoke_reason = 'user' from agent_oauth_grants where id = :'h1_grant')
  and not exists (select 1 from agent_oauth_tokens t join agent_oauth_grants g on g.id = t.grant_id where g.user_id = pg_temp.uid('u6')));
select pg_temp.check('H: revoke_all again -> 0', revoke_all_agent_oauth_grants(pg_temp.uid('u6')) = 0);
select pg_temp.check('H: revoke_all for a user with no grants -> 0', revoke_all_agent_oauth_grants(pg_temp.uid('u8')) = 0);
select pg_temp.check('H: revoked access token cannot be rotated / looked up as active',
  (select outcome = 'invalid_grant' from rotate_agent_oauth_refresh(pg_temp.h('h3-rt'), pg_temp.cid('c3'), pg_temp.h('h3-at2'), pg_temp.h('h3-rt2'))));

-- ═══ I. Cleanup ═══
insert into agent_oauth_clients (client_id, token_endpoint_auth_method, grant_types, client_name, redirect_uris, created_at, first_authorized_at) values
  (pg_temp.cid('i-old'),      'none', array['authorization_code'], 'Old unused',  array['https://example.com/cb'], now() - interval '25 hours', null),
  (pg_temp.cid('i-new'),      'none', array['authorization_code'], 'New unused',  array['https://example.com/cb'], now() - interval '23 hours', null),
  (pg_temp.cid('i-grant'),    'none', array['authorization_code'], 'Has grant',   array['https://example.com/cb'], now() - interval '25 hours', null),
  (pg_temp.cid('i-authold'),  'none', array['authorization_code'], 'Authorized',  array['https://example.com/cb'], now() - interval '40 days', now() - interval '40 days');
-- A code on the old unused client disappears with it (cascade), but isn't past retention itself.
insert into agent_oauth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, scopes, resource, expires_at) values
  (pg_temp.h('i-code-oldclient'), pg_temp.cid('i-old'), pg_temp.uid('u9'), 'https://example.com/cb', :chal, array['wins:read'], :res, now() + interval '1 minute'),
  (pg_temp.h('i-code-2d'),  pg_temp.cid('c14'), pg_temp.uid('u9'), 'https://example.com/cb', :chal, array['wins:read'], :res, now() - interval '2 days'),
  (pg_temp.h('i-code-1h'),  pg_temp.cid('c14'), pg_temp.uid('u9'), 'https://example.com/cb', :chal, array['wins:read'], :res, now() - interval '1 hour');
insert into agent_oauth_grants (id, user_id, client_id, client_name, resource, scopes, expires_at, last_used_at) values
  ('00000000-0000-0000-0000-0000000000a1', pg_temp.uid('u9'), pg_temp.cid('c14'),     'Client 14', :res, array['wins:read'], null, now()),
  ('00000000-0000-0000-0000-0000000000a2', pg_temp.uid('u8'), pg_temp.cid('c1'),      'Client 1',  :res, array['wins:read'], null, now() - interval '31 days'),
  ('00000000-0000-0000-0000-0000000000a3', pg_temp.uid('u8'), pg_temp.cid('c2'),      'Client 2',  :res, array['wins:read'], now() + interval '10 days', now() - interval '31 days'),
  ('00000000-0000-0000-0000-0000000000a4', pg_temp.uid('u8'), pg_temp.cid('c3'),      'Client 3',  :res, array['wins:read'], null, now() - interval '29 days'),
  ('00000000-0000-0000-0000-0000000000a5', pg_temp.uid('u8'), pg_temp.cid('i-grant'), 'Has grant', :res, array['wins:read'], null, now());
insert into agent_oauth_tokens (token_hash, grant_id, kind, pair_id, expires_at, consumed_at, superseded_at) values
  (pg_temp.h('i-at-25h'),      '00000000-0000-0000-0000-0000000000a1', 'access',  gen_random_uuid(), now() - interval '25 hours', null, null),
  (pg_temp.h('i-at-23h'),      '00000000-0000-0000-0000-0000000000a1', 'access',  gen_random_uuid(), now() - interval '23 hours', null, null),
  (pg_temp.h('i-rt-consumed'), '00000000-0000-0000-0000-0000000000a1', 'refresh', gen_random_uuid(), now() + interval '10 days',  now() - interval '20 days', null),
  (pg_temp.h('i-rt-2d-cons'),  '00000000-0000-0000-0000-0000000000a1', 'refresh', gen_random_uuid(), now() - interval '2 days',   now() - interval '31 days', null),
  (pg_temp.h('i-rt-2d'),       '00000000-0000-0000-0000-0000000000a1', 'refresh', gen_random_uuid(), now() - interval '2 days',   null, null),
  (pg_temp.h('i-rt-superseded'), '00000000-0000-0000-0000-0000000000a1', 'refresh', gen_random_uuid(), now() + interval '10 days', null, now() - interval '20 days'),
  (pg_temp.h('i-rt-2d-sup'),   '00000000-0000-0000-0000-0000000000a1', 'refresh', gen_random_uuid(), now() - interval '2 days',   null, now() - interval '31 days'),
  (pg_temp.h('i-idle-at'),     '00000000-0000-0000-0000-0000000000a2', 'access',  gen_random_uuid(), now() + interval '1 hour',   null, null),
  (pg_temp.h('i-idle-rt'),     '00000000-0000-0000-0000-0000000000a2', 'refresh', gen_random_uuid(), now() + interval '1 day',    null, null);
select * from delete_expired_agent_oauth_rows() \gset i_
select pg_temp.check(format('I: counts idle=%s codes=%s access=%s refresh=%s clients=%s (expect 1,1,1,3,1)',
    :i_idle_grants_revoked, :i_codes_deleted, :i_access_tokens_deleted, :i_refresh_tokens_deleted, :i_clients_deleted),
  :i_idle_grants_revoked = 1 and :i_codes_deleted = 1 and :i_access_tokens_deleted = 1
  and :i_refresh_tokens_deleted = 3 and :i_clients_deleted = 1);
select pg_temp.check('I: code >1 day past expiry deleted; code 1 hour past expiry kept',
  not exists (select 1 from agent_oauth_codes where code_hash = pg_temp.h('i-code-2d'))
  and exists (select 1 from agent_oauth_codes where code_hash = pg_temp.h('i-code-1h')));
select pg_temp.check('I: access token 25 h past expiry deleted; 23 h kept',
  not exists (select 1 from agent_oauth_tokens where token_hash = pg_temp.h('i-at-25h'))
  and exists (select 1 from agent_oauth_tokens where token_hash = pg_temp.h('i-at-23h')));
select pg_temp.check('I: consumed and superseded refresh tokens kept until their own expiry; expired refresh (consumed, superseded or neither) deleted',
  exists (select 1 from agent_oauth_tokens where token_hash = pg_temp.h('i-rt-consumed'))
  and exists (select 1 from agent_oauth_tokens where token_hash = pg_temp.h('i-rt-superseded'))
  and not exists (select 1 from agent_oauth_tokens where token_hash in (pg_temp.h('i-rt-2d-cons'), pg_temp.h('i-rt-2d'), pg_temp.h('i-rt-2d-sup'))));
select pg_temp.check('I: unused client >24 h deleted (its code cascaded); unused client <24 h kept',
  not exists (select 1 from agent_oauth_clients where client_id = pg_temp.cid('i-old'))
  and not exists (select 1 from agent_oauth_codes where code_hash = pg_temp.h('i-code-oldclient'))
  and exists (select 1 from agent_oauth_clients where client_id = pg_temp.cid('i-new')));
select pg_temp.check('I: client with a grant never deleted (even with first_authorized_at null); authorized old client kept',
  exists (select 1 from agent_oauth_clients where client_id = pg_temp.cid('i-grant'))
  and exists (select 1 from agent_oauth_clients where client_id = pg_temp.cid('i-authold')));
select pg_temp.check('I: never-expiring grant idle 31 d revoked (idle) and its tokens deleted',
  (select revoke_reason = 'idle' from agent_oauth_grants where id = '00000000-0000-0000-0000-0000000000a2')
  and not exists (select 1 from agent_oauth_tokens where grant_id = '00000000-0000-0000-0000-0000000000a2'));
select pg_temp.check('I: expiring grant idle 31 d and never-expiring grant idle 29 d stay active',
  (select bool_and(revoked_at is null) from agent_oauth_grants where id in ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4')));
select * from delete_expired_agent_oauth_rows() \gset i2_
select pg_temp.check('I: second run is a no-op',
  :i2_idle_grants_revoked = 0 and :i2_codes_deleted = 0 and :i2_access_tokens_deleted = 0
  and :i2_refresh_tokens_deleted = 0 and :i2_clients_deleted = 0);
do $$ begin
  delete from agent_oauth_clients where client_id = 'co_client_' || substr(md5('i-grant'), 1, 22);
  raise exception 'FAIL: client with grants deleted';
exception when foreign_key_violation then raise notice 'PASS: I: on delete restrict blocks deleting a client that has grants';
end $$;

-- ═══ J setup (for 045_mcp_oauth_verify.sh): one code for the parallel exchange ═══
select pg_temp.check('J: create code for the parallel exchange',
  (select outcome = 'ok' from create_agent_oauth_code(pg_temp.uid('u7'), pg_temp.cid('c1'), pg_temp.h('j1'), 'https://example.com/cb', :chal, array['wins:read'], null, :res)));
