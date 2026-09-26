-- db/tests/mcp_agent_access_verify.sql
--
-- Behavioral checks for drizzle/0003_mcp_agent_access.sql. Run by hand against
-- a throwaway local Postgres 16, never against Supabase. Not run by Jest or
-- CI. db/tests/mcp_agent_access_verify.sh builds the production-like base,
-- seeds the pre-migration rows these checks expect, and applies the drizzle
-- migrations through 0003 before running this file. Every check prints
-- "PASS: ..."; the first failure stops the run with "FAIL: ...".

\set QUIET on
\o /dev/null
set client_min_messages = notice;

create function pg_temp.check(label text, ok boolean) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
-- SQLSTATE and constraint name raised by a statement, or 'ok'.
create function pg_temp.outcome(stmt text) returns text language plpgsql as $$
declare
  state text;
  constraint_name text;
  message text;
begin
  execute stmt;
  return 'ok';
exception when others then
  get stacked diagnostics state = returned_sqlstate, constraint_name = constraint_name, message = message_text;
  return state || coalesce(':' || nullif(constraint_name, ''), ':' || message);
end $$;
create function pg_temp.h(t text) returns text language sql as $$ select encode(sha256(t::bytea), 'hex') $$;

\set pre '''00000000-0000-4000-8000-00000000000a'''
\set u1 '''00000000-0000-4000-8000-0000000000b1'''
\set u2 '''00000000-0000-4000-8000-0000000000b2'''
insert into auth.users (id) values (:u1), (:u2);
insert into public.profiles (id, email) values (:u1, 'u1@example.com'), (:u2, 'u2@example.com');

-- ═══ wins ═══
select pg_temp.check('wins: occurred_at backfilled from created_at in UTC',
  (select array_agg(occurred_at order by text) = array['2024-12-31', '2025-03-02']::date[]
     from wins where user_id = :pre));
select pg_temp.check('wins: occurred_at is NOT NULL',
  (select attnotnull from pg_attribute where attrelid = 'public.wins'::regclass and attname = 'occurred_at'));
insert into wins (user_id, text) values (:u1, 'default date');
select pg_temp.check('wins: occurred_at defaults to today in UTC',
  (select occurred_at = (now() at time zone 'utc')::date from wins where text = 'default date'));
select pg_temp.check('wins: occurred_at before 1970 rejected by wins_occurred_at_check',
  pg_temp.outcome($$insert into wins (user_id, text, occurred_at) values ('00000000-0000-4000-8000-0000000000b1', 'old', '1969-12-31')$$)
    = '23514:wins_occurred_at_check');
select pg_temp.check('wins: exactly one CHECK on source, named wins_source_check',
  (select array_agg(conname::text) = array['wins_source_check'] from pg_constraint
     where conrelid = 'public.wins'::regclass and contype = 'c'
       and (select attnum from pg_attribute where attrelid = 'public.wins'::regclass and attname = 'source') = any (conkey)));
select pg_temp.check('wins: source agent accepted',
  pg_temp.outcome($$insert into wins (user_id, text, source) values ('00000000-0000-4000-8000-0000000000b1', 'from agent', 'agent')$$) = 'ok');
select pg_temp.check('wins: pre-existing sources still accepted',
  pg_temp.outcome($$insert into wins (user_id, text, source) values ('00000000-0000-4000-8000-0000000000b1', 'z', 'zero_to_case'), ('00000000-0000-4000-8000-0000000000b1', 'i', 'import')$$) = 'ok');
select pg_temp.check('wins: unknown source rejected',
  pg_temp.outcome($$insert into wins (user_id, text, source) values ('00000000-0000-4000-8000-0000000000b1', 'x', 'bogus')$$) = '23514:wins_source_check');
select pg_temp.check('wins: wins_tag_check untouched',
  pg_temp.outcome($$insert into wins (user_id, text, tag) values ('00000000-0000-4000-8000-0000000000b1', 'x', 'bogus')$$) = '23514:wins_tag_check');
select pg_temp.check('wins: evidence_url over 2048 chars rejected',
  pg_temp.outcome(format($$insert into wins (user_id, text, evidence_url) values ('00000000-0000-4000-8000-0000000000b1', 'x', %L)$$, repeat('a', 2049)))
    = '23514:wins_evidence_url_check'
  and pg_temp.outcome(format($$insert into wins (user_id, text, evidence_url) values ('00000000-0000-4000-8000-0000000000b1', 'x', %L)$$, repeat('a', 2048))) = 'ok');
select pg_temp.check('wins: external_ref must be 1..200 chars',
  pg_temp.outcome($$insert into wins (user_id, text, external_ref) values ('00000000-0000-4000-8000-0000000000b1', 'x', '')$$) = '23514:wins_external_ref_check'
  and pg_temp.outcome(format($$insert into wins (user_id, text, external_ref) values ('00000000-0000-4000-8000-0000000000b1', 'x', %L)$$, repeat('r', 201))) = '23514:wins_external_ref_check');
select pg_temp.check('wins: external_ref unique per user, reported as wins_user_external_ref_key',
  pg_temp.outcome($$insert into wins (user_id, text, external_ref) values ('00000000-0000-4000-8000-0000000000b1', 'a', 'ref-1')$$) = 'ok'
  and pg_temp.outcome($$insert into wins (user_id, text, external_ref) values ('00000000-0000-4000-8000-0000000000b1', 'b', 'ref-1')$$) = '23505:wins_user_external_ref_key'
  and pg_temp.outcome($$insert into wins (user_id, text, external_ref) values ('00000000-0000-4000-8000-0000000000b2', 'c', 'ref-1')$$) = 'ok');
select pg_temp.check('wins: rows without external_ref are unaffected by the unique index',
  (select count(*) >= 2 from wins where user_id = :u1 and external_ref is null));
select pg_temp.check('wins: wins_user_occurred_idx is (user_id, occurred_at DESC)',
  (select indexdef like '%(user_id, occurred_at DESC)' from pg_indexes where indexname = 'wins_user_occurred_idx'));

-- ═══ comp_entries ═══
select pg_temp.check('comp_entries: existing row gets source manual, no external_ref, null updated_at',
  (select source = 'manual' and external_ref is null and updated_at is null from comp_entries where user_id = :pre));
select pg_temp.check('comp_entries: source agent accepted, unknown rejected by comp_entries_source_check',
  pg_temp.outcome($$insert into comp_entries (user_id, effective_date, base, source) values ('00000000-0000-4000-8000-0000000000b1', '2025-01-01', 1, 'agent')$$) = 'ok'
  and pg_temp.outcome($$insert into comp_entries (user_id, effective_date, base, source) values ('00000000-0000-4000-8000-0000000000b1', '2025-01-01', 1, 'recap')$$) = '23514:comp_entries_source_check');
select pg_temp.check('comp_entries: external_ref unique per user, reported as comp_entries_user_external_ref_key',
  pg_temp.outcome($$insert into comp_entries (user_id, effective_date, base, external_ref) values ('00000000-0000-4000-8000-0000000000b1', '2025-01-01', 1, 'c-1')$$) = 'ok'
  and pg_temp.outcome($$insert into comp_entries (user_id, effective_date, base, external_ref) values ('00000000-0000-4000-8000-0000000000b1', '2025-01-01', 1, 'c-1')$$) = '23505:comp_entries_user_external_ref_key'
  and pg_temp.outcome($$insert into comp_entries (user_id, effective_date, base, external_ref) values ('00000000-0000-4000-8000-0000000000b1', '2025-01-01', 1, '')$$) = '23514:comp_entries_external_ref_check');

-- ═══ agent_tokens ═══
select pg_temp.check('agent_tokens: RLS on, no policies',
  (select relrowsecurity from pg_class where oid = 'public.agent_tokens'::regclass)
  and not exists (select 1 from pg_policies where tablename = 'agent_tokens'));
select pg_temp.check('create_agent_token: not executable by anon/authenticated/public, executable by service_role',
  not has_function_privilege('anon', 'public.create_agent_token(uuid, text, text, text, text[], timestamptz, int)', 'execute')
  and not has_function_privilege('authenticated', 'public.create_agent_token(uuid, text, text, text, text[], timestamptz, int)', 'execute')
  and has_function_privilege('service_role', 'public.create_agent_token(uuid, text, text, text, text[], timestamptz, int)', 'execute'));
select pg_temp.check('create_agent_token: security definer with search_path=public',
  (select prosecdef and proconfig @> array['search_path=public'] from pg_proc where proname = 'create_agent_token'));
select pg_temp.check('create_agent_token: result has no token_hash',
  (select pg_get_function_result(oid) not like '%token_hash%' and pg_get_function_result(oid) like '%revoked_at%'
     from pg_proc where proname = 'create_agent_token'));

set role service_role;
select pg_temp.check('create_agent_token: creates a token and returns it',
  (select name = 'laptop' and scopes = array['wins:read'] and revoked_at is null
     from create_agent_token(:u1, 'laptop', pg_temp.h('t1'), 'co_pat_abcd', array['wins:read'], null, 2)));
select pg_temp.check('create_agent_token: a live token with the same name -> agent_tokens_user_active_name_key',
  pg_temp.outcome(format($$select create_agent_token(%L, 'laptop', %L, 'co_pat_x', array['wins:read'], null, 5)$$,
    '00000000-0000-4000-8000-0000000000b1', pg_temp.h('t2'))) = '23505:agent_tokens_user_active_name_key');
select pg_temp.check('create_agent_token: second token under the limit',
  (select count(*) = 1 from create_agent_token(:u1, 'desktop', pg_temp.h('t3'), 'co_pat_efgh', array['wins:read', 'wins:write'], now() + interval '30 days', 2)));
select pg_temp.check('create_agent_token: over the limit raises P0001 agent_token_limit',
  pg_temp.outcome(format($$select create_agent_token(%L, 'third', %L, 'co_pat_y', array['wins:read'], null, 2)$$,
    '00000000-0000-4000-8000-0000000000b1', pg_temp.h('t4'))) = 'P0001:agent_token_limit');
reset role;
update agent_tokens set expires_at = now() - interval '1 minute' where token_hash = pg_temp.h('t3');
set role service_role;
select pg_temp.check('create_agent_token: an expired token frees its slot and its name',
  (select count(*) = 1 from create_agent_token(:u1, 'desktop', pg_temp.h('t5'), 'co_pat_ijkl', array['comp:read'], now() + interval '7 days', 2)));
reset role;
select pg_temp.check('create_agent_token: the expired token holding the name was revoked',
  (select revoked_at is not null from agent_tokens where token_hash = pg_temp.h('t3')));
select pg_temp.check('create_agent_token: tokens are per user',
  (select count(*) = 1 from create_agent_token(:u2, 'laptop', pg_temp.h('t6'), 'co_pat_mnop', array['career:read'], null, 1)));
select pg_temp.check('agent_tokens: unknown or empty scopes rejected by agent_tokens_scopes_check',
  pg_temp.outcome(format($$insert into agent_tokens (user_id, name, token_hash, token_prefix, scopes) values (%L, 'a', %L, 'p', array['admin'])$$,
    '00000000-0000-4000-8000-0000000000b2', pg_temp.h('t7'))) = '23514:agent_tokens_scopes_check'
  and pg_temp.outcome(format($$insert into agent_tokens (user_id, name, token_hash, token_prefix, scopes) values (%L, 'a', %L, 'p', array[]::text[])$$,
    '00000000-0000-4000-8000-0000000000b2', pg_temp.h('t8'))) = '23514:agent_tokens_scopes_check');
select pg_temp.check('agent_tokens: token_hash must be 64 hex chars, name 1..60 chars',
  pg_temp.outcome($$insert into agent_tokens (user_id, name, token_hash, token_prefix, scopes) values ('00000000-0000-4000-8000-0000000000b2', 'a', 'nothex', 'p', array['wins:read'])$$) = '23514:agent_tokens_token_hash_check'
  and pg_temp.outcome(format($$insert into agent_tokens (user_id, name, token_hash, token_prefix, scopes) values (%L, %L, %L, 'p', array['wins:read'])$$,
    '00000000-0000-4000-8000-0000000000b2', repeat('n', 61), pg_temp.h('t9'))) = '23514:agent_tokens_name_check');
select pg_temp.check('agent_tokens: token_hash unique, reported as agent_tokens_token_hash_key',
  pg_temp.outcome(format($$insert into agent_tokens (user_id, name, token_hash, token_prefix, scopes) values (%L, 'dup', %L, 'p', array['wins:read'])$$,
    '00000000-0000-4000-8000-0000000000b2', pg_temp.h('t1'))) = '23505:agent_tokens_token_hash_key');
delete from profiles where id = :u2;
select pg_temp.check('agent_tokens: deleting a profile cascades to its tokens',
  not exists (select 1 from agent_tokens where user_id = :u2));
