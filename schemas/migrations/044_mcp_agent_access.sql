-- 044_mcp_agent_access.sql
--
-- CareerOtter MCP server: personal access tokens for agents, plus the columns
-- agents need to write wins and comp entries idempotently.
--
-- - agent_tokens: named, scoped, revocable tokens. Only the SHA-256 hash of the
--   raw token is stored; token_prefix is kept for display. Service-role only
--   (RLS enabled, no policies), like every CareerOtter table.
-- - create_agent_token(): inserts a token while enforcing the per-user active
--   token limit atomically.
-- - wins: occurred_at (when the win happened, as opposed to when it was logged),
--   evidence_url, external_ref (the agent's idempotency key), and 'agent' as a
--   source.
-- - comp_entries: source, external_ref and updated_at, for the same reasons.
--
-- external_ref is unique per user only where present, so rows typed in by hand
-- (external_ref null) are unaffected. The service catches the unique violation
-- by constraint name (*_user_external_ref_key) to return the existing row, so
-- those index names are load-bearing.
--
-- Constants that mirror these CHECK lists live in lib/constants/agent-access.ts
-- and lib/constants/careerotter.ts (guarded by
-- __tests__/constants/agent-access.test.ts).

-- One transaction: scripts/run-schema.sh does not stop on error, so without it
-- a failed step (e.g. re-adding the source CHECK) would leave the rest applied.
begin;

-- ── agent_tokens ───────────────────────────────────────────────────────────
create table if not exists public.agent_tokens (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null,
  scopes text[] not null
    check (
      cardinality(scopes) > 0
      and scopes <@ array['wins:read', 'wins:write', 'career:read', 'comp:read', 'comp:write']::text[]
    ),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
);

create index if not exists agent_tokens_user_idx
  on public.agent_tokens (user_id);

-- Revoked tokens keep their row for audit, so a name can be reused once the
-- earlier token holding it is revoked.
create unique index if not exists agent_tokens_user_active_name_key
  on public.agent_tokens (user_id, name)
  where revoked_at is null;

alter table public.agent_tokens enable row level security;
-- Intentionally no policies: only the service-role key (used by API routes)
-- bypasses RLS. Client access is denied by default.

-- ── create_agent_token ─────────────────────────────────────────────────────
-- Creates a token under the per-user active-token limit atomically. A
-- transaction-scoped advisory lock per user serializes concurrent creates, so
-- two requests cannot both pass the count. Expired tokens holding the name are
-- revoked first: the active-name index only exempts revoked rows, so an
-- expired token would otherwise hold its name forever. Over the limit it
-- raises 'agent_token_limit' (P0001); a live token with the same name still
-- fails on agent_tokens_user_active_name_key (23505). Returns the new row
-- without token_hash. Service-role only, like the table.
create or replace function public.create_agent_token (
  p_user_id uuid,
  p_name text,
  p_token_hash text,
  p_token_prefix text,
  p_scopes text[],
  p_expires_at timestamptz,
  p_max_active int
)
returns table (
  id uuid,
  user_id uuid,
  name text,
  token_prefix text,
  scopes text[],
  created_at timestamptz,
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  active_count int;
begin
  perform pg_advisory_xact_lock(hashtext('agent_tokens:' || p_user_id::text));

  update agent_tokens t
    set revoked_at = now()
    where t.user_id = p_user_id
      and t.name = p_name
      and t.revoked_at is null
      and t.expires_at <= now();

  select count(*) into active_count
    from agent_tokens t
    where t.user_id = p_user_id
      and t.revoked_at is null
      and (t.expires_at is null or t.expires_at > now());

  if active_count >= p_max_active then
    raise exception using errcode = 'P0001', message = 'agent_token_limit';
  end if;

  return query
    insert into agent_tokens as t
      (user_id, name, token_hash, token_prefix, scopes, expires_at)
    values
      (p_user_id, p_name, p_token_hash, p_token_prefix, p_scopes, p_expires_at)
    returning
      t.id, t.user_id, t.name, t.token_prefix, t.scopes,
      t.created_at, t.last_used_at, t.expires_at, t.revoked_at;
end;
$$;

revoke execute on function public.create_agent_token (
  uuid, text, text, text, text[], timestamptz, int
) from public, anon, authenticated;

grant execute on function public.create_agent_token (
  uuid, text, text, text, text[], timestamptz, int
) to service_role;

-- ── wins: occurred_at ──────────────────────────────────────────────────────
-- Added nullable so existing rows can be backfilled from created_at (in UTC,
-- matching how the server evaluates dates) before NOT NULL is enforced.
alter table public.wins
  add column if not exists occurred_at date
    check (occurred_at >= date '1970-01-01');

-- Default first, so rows inserted by the running app during the backfill
-- can't arrive null and fail SET NOT NULL. UTC to match the backfill.
alter table public.wins
  alter column occurred_at set default ((now() at time zone 'utc')::date);

update public.wins
  set occurred_at = (created_at at time zone 'utc')::date
  where occurred_at is null;

alter table public.wins alter column occurred_at set not null;

create index if not exists wins_user_occurred_idx
  on public.wins (user_id, occurred_at desc);

-- ── wins: evidence_url, external_ref ───────────────────────────────────────
alter table public.wins
  add column if not exists evidence_url text
    check (char_length(evidence_url) <= 2048);

alter table public.wins
  add column if not exists external_ref text
    check (char_length(external_ref) between 1 and 200);

create unique index if not exists wins_user_external_ref_key
  on public.wins (user_id, external_ref)
  where external_ref is not null;

-- ── wins: widen source to include 'agent' ──────────────────────────────────
-- Prod has drifted from the migrations before (see 037), so the existing CHECK
-- on source is found by the column it constrains rather than by its expected
-- name, and every such constraint is dropped before the named one is added.
do $$
declare
  source_attnum smallint;
  constraint_row record;
begin
  select attnum into source_attnum
    from pg_attribute
    where attrelid = 'public.wins'::regclass
      and attname = 'source'
      and not attisdropped;

  if source_attnum is null then
    raise exception 'public.wins.source column not found';
  end if;

  for constraint_row in
    select conname
      from pg_constraint
      where conrelid = 'public.wins'::regclass
        and contype = 'c'
        and source_attnum = any (conkey)
  loop
    execute format(
      'alter table public.wins drop constraint %I',
      constraint_row.conname
    );
  end loop;
end
$$;

alter table public.wins
  add constraint wins_source_check
    check (source in ('manual', 'recap', 'zero_to_case', 'import', 'agent'));

do $$
begin
  if not exists (
    select 1
      from pg_constraint
      where conrelid = 'public.wins'::regclass
        and conname = 'wins_source_check'
        and contype = 'c'
  ) then
    raise exception 'wins_source_check is missing on public.wins';
  end if;
end
$$;

-- ── comp_entries: source, external_ref, updated_at ─────────────────────────
alter table public.comp_entries
  add column if not exists source text not null default 'manual'
    constraint comp_entries_source_check
      check (source in ('manual', 'agent'));

alter table public.comp_entries
  add column if not exists external_ref text
    check (char_length(external_ref) between 1 and 200);

-- Null until the row is edited; set by the service on agent updates.
alter table public.comp_entries
  add column if not exists updated_at timestamptz;

create unique index if not exists comp_entries_user_external_ref_key
  on public.comp_entries (user_id, external_ref)
  where external_ref is not null;

commit;
