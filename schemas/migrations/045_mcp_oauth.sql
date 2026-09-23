-- 045_mcp_oauth.sql
--
-- CareerOtter MCP server: a self-hosted OAuth 2.1 authorization server for
-- /api/mcp, alongside the personal access tokens from 044.
--
-- - agent_oauth_clients: dynamically registered clients (RFC 7591).
-- - agent_oauth_grants: one row per approved connection (user + client).
-- - agent_oauth_tokens: opaque access and refresh tokens, stored as SHA-256.
-- - agent_oauth_codes: single-use authorization codes, stored as SHA-256.
--
-- Every table is service-role only (RLS enabled, no policies), like
-- agent_tokens. Every function the API calls is security definer and
-- executable by service_role only; the internal helpers are executable by no
-- API role. Every expiry is computed here with now(), so one clock decides
-- them all.
--
-- The functions report expected outcomes (bad code, reuse, the grant cap) in an
-- `outcome` column instead of raising, so the TypeScript layer can map them to
-- OAuth errors. They raise only on programming errors (a missing required
-- argument, or a CHECK or FK failure).
--
-- Constants that mirror these CHECK lists, lifetimes, outcomes and the grant
-- cap live in lib/constants/agent-oauth.ts (guarded by
-- __tests__/constants/agent-oauth.test.ts).

-- One transaction: scripts/run-schema.sh does not stop on error.
begin;

-- ── helpers used by CHECK constraints ──────────────────────────────────────
-- CHECK constraints can't use subqueries, so the per-element length limit on
-- redirect_uris goes through an immutable function.
create or replace function public.agent_oauth_max_char_length (p_values text[])
returns int
language sql
immutable
strict
set search_path = public
as $$
  select coalesce(max(char_length(v)), 0) from unnest(p_values) as v;
$$;

revoke execute on function public.agent_oauth_max_char_length (text[])
  from public, anon, authenticated;

grant execute on function public.agent_oauth_max_char_length (text[])
  to service_role;

-- ── agent_oauth_clients ────────────────────────────────────────────────────
create table if not exists public.agent_oauth_clients (
  client_id text primary key
    check (client_id ~ '^co_client_[A-Za-z0-9_-]{22}$'),
  client_secret_hash text
    check (client_secret_hash ~ '^[0-9a-f]{64}$'),
  token_endpoint_auth_method text not null
    check (token_endpoint_auth_method in ('none', 'client_secret_basic', 'client_secret_post')),
  grant_types text[] not null
    check (
      cardinality(grant_types) > 0
      and grant_types <@ array['authorization_code', 'refresh_token']::text[]
      and 'authorization_code' = any (grant_types)
    ),
  client_name text not null check (char_length(client_name) between 1 and 100),
  client_uri text
    check (char_length(client_uri) <= 512 and client_uri ~ '^https://'),
  redirect_uris text[] not null
    check (
      cardinality(redirect_uris) between 1 and 5
      and array_position(redirect_uris, null) is null
      and '' <> all (redirect_uris)
      and agent_oauth_max_char_length(redirect_uris) <= 512
    ),
  created_at timestamptz not null default now(),
  first_authorized_at timestamptz,
  -- A secret exists exactly when the client authenticates with one.
  constraint agent_oauth_clients_secret_matches_method check (
    (token_endpoint_auth_method = 'none') = (client_secret_hash is null)
  )
);

create index if not exists agent_oauth_clients_created_idx
  on public.agent_oauth_clients (created_at);

alter table public.agent_oauth_clients enable row level security;

-- ── agent_oauth_grants ─────────────────────────────────────────────────────
create table if not exists public.agent_oauth_grants (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Restrict, so cleanup never deletes a client that a grant still names.
  client_id text not null
    references public.agent_oauth_clients (client_id) on delete restrict,
  -- Snapshot for the connected-apps list.
  client_name text not null check (char_length(client_name) between 1 and 100),
  resource text not null check (char_length(resource) between 1 and 512),
  scopes text[] not null
    check (
      cardinality(scopes) > 0
      and scopes <@ array['wins:read', 'wins:write', 'career:read', 'comp:read', 'comp:write']::text[]
      and (not (scopes @> array['wins:write']::text[]) or scopes @> array['wins:read']::text[])
      and (not (scopes @> array['comp:write']::text[]) or scopes @> array['comp:read']::text[])
    ),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text
    check (revoke_reason in ('user', 'user_all', 'client', 'replaced', 'refresh_reuse', 'code_reuse', 'idle')),
  -- Comp data is the most sensitive the agent API exposes, so a grant that
  -- carries a comp scope must expire, as for PATs.
  constraint agent_oauth_grants_comp_requires_expiry check (
    expires_at is not null
    or not (scopes && array['comp:read', 'comp:write']::text[])
  ),
  constraint agent_oauth_grants_revoke_reason_matches check (
    (revoked_at is null) = (revoke_reason is null)
  )
);

create unique index if not exists agent_oauth_grants_user_client_active_key
  on public.agent_oauth_grants (user_id, client_id)
  where revoked_at is null;

create index if not exists agent_oauth_grants_user_created_idx
  on public.agent_oauth_grants (user_id, created_at desc);

-- Backs the on delete restrict check when cleanup deletes clients.
create index if not exists agent_oauth_grants_client_idx
  on public.agent_oauth_grants (client_id);

alter table public.agent_oauth_grants enable row level security;

-- ── agent_oauth_tokens ─────────────────────────────────────────────────────
create table if not exists public.agent_oauth_tokens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  grant_id uuid not null references public.agent_oauth_grants (id) on delete cascade,
  kind text not null check (kind in ('access', 'refresh')),
  -- Shared by the access and refresh tokens issued together, so superseding a
  -- refresh token can delete the access token that came with it.
  pair_id uuid not null,
  -- On refresh tokens issued by rotation: the hash of the refresh token that
  -- was presented. Null for tokens issued at code exchange. Not a foreign key:
  -- cleanup may delete the parent first.
  rotated_from_hash text check (rotated_from_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- Set on refresh tokens once rotated. Kept until the token's own expiry, so
  -- reuse is detected for as long as the token could have been used.
  consumed_at timestamptz,
  -- Set on an unconsumed refresh token when a grace reissue for its parent
  -- replaces it. Presenting it afterwards is reuse. Kept until its own expiry,
  -- like a consumed token.
  superseded_at timestamptz,
  -- Extra pairs issued for this consumed token inside the grace window.
  grace_reissues int not null default 0 check (grace_reissues between 0 and 5),
  constraint agent_oauth_tokens_rotation_is_refresh check (
    kind = 'refresh'
    or (
      consumed_at is null
      and superseded_at is null
      and grace_reissues = 0
      and rotated_from_hash is null
    )
  ),
  -- Only an unconsumed token is superseded, and a superseded one is never
  -- consumed.
  constraint agent_oauth_tokens_consumed_or_superseded check (
    consumed_at is null or superseded_at is null
  )
);

create index if not exists agent_oauth_tokens_grant_idx
  on public.agent_oauth_tokens (grant_id);

-- Finds the successors of a presented refresh token.
create index if not exists agent_oauth_tokens_rotated_from_idx
  on public.agent_oauth_tokens (rotated_from_hash)
  where rotated_from_hash is not null;

create index if not exists agent_oauth_tokens_expires_idx
  on public.agent_oauth_tokens (expires_at);

alter table public.agent_oauth_tokens enable row level security;

-- ── agent_oauth_codes ──────────────────────────────────────────────────────
create table if not exists public.agent_oauth_codes (
  code_hash text primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  client_id text not null
    references public.agent_oauth_clients (client_id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- The registered URI that matched, exactly as registered.
  redirect_uri text not null check (char_length(redirect_uri) between 1 and 512),
  code_challenge text not null check (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  scopes text[] not null
    check (
      cardinality(scopes) > 0
      and scopes <@ array['wins:read', 'wins:write', 'career:read', 'comp:read', 'comp:write']::text[]
      and (not (scopes @> array['wins:write']::text[]) or scopes @> array['wins:read']::text[])
      and (not (scopes @> array['comp:write']::text[]) or scopes @> array['comp:read']::text[])
    ),
  -- The chosen grant lifetime; null means the grant never expires. The upper
  -- bound is the longest PAT expiry option, and also rejects infinity.
  grant_expires_in interval
    check (grant_expires_in > interval '0' and grant_expires_in <= interval '365 days'),
  resource text not null check (char_length(resource) between 1 and 512),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  -- Set by the exchange, so reusing the code can revoke the grant it produced.
  grant_id uuid references public.agent_oauth_grants (id) on delete set null,
  constraint agent_oauth_codes_comp_requires_expiry check (
    grant_expires_in is not null
    or not (scopes && array['comp:read', 'comp:write']::text[])
  )
);

create index if not exists agent_oauth_codes_expires_idx
  on public.agent_oauth_codes (expires_at);

-- Backs the cascade when cleanup deletes clients.
create index if not exists agent_oauth_codes_client_idx
  on public.agent_oauth_codes (client_id);

alter table public.agent_oauth_codes enable row level security;
-- Intentionally no policies on any of the four tables: only the service-role
-- key (used by API routes) bypasses RLS. Client access is denied by default.

-- ── internal: grant cap ────────────────────────────────────────────────────
-- True when the user already has the maximum number of active grants, not
-- counting one for p_client_id (approving that client replaces it). Callers
-- hold the per-user advisory lock. Not executable by any API role.
create or replace function public.agent_oauth_grant_cap_reached (
  p_user_id uuid,
  p_client_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c_max_active_grants constant int := 10;
  other_active_count int;
begin
  select count(*) into other_active_count
    from agent_oauth_grants g
    where g.user_id = p_user_id
      and g.client_id <> p_client_id
      and g.revoked_at is null
      and (g.expires_at is null or g.expires_at > now());

  return other_active_count >= c_max_active_grants;
end;
$$;

revoke execute on function public.agent_oauth_grant_cap_reached (uuid, text)
  from public, anon, authenticated, service_role;

-- ── internal: issue a token pair ───────────────────────────────────────────
-- Inserts an access token and, when p_refresh_hash is given, a refresh token
-- for the grant, each capped at the grant's expiry and sharing one pair_id.
-- p_rotated_from_hash is the refresh token the pair replaces (null at code
-- exchange). Returns the access token's remaining lifetime in whole seconds
-- (for expires_in) and the refresh token's expiry (null when none was issued).
-- Not executable by any API role.
create or replace function public.agent_oauth_issue_tokens (
  p_grant_id uuid,
  p_grant_expires_at timestamptz,
  p_access_hash text,
  p_refresh_hash text,
  p_rotated_from_hash text,
  out access_expires_in int,
  out refresh_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c_access_ttl constant interval := interval '24 hours';
  c_refresh_idle_ttl constant interval := interval '30 days';
  access_expires_at timestamptz;
  new_pair_id uuid := gen_random_uuid ();
begin
  -- least() ignores nulls, so a grant that never expires leaves the TTL as is.
  access_expires_at := least(now() + c_access_ttl, p_grant_expires_at);

  insert into agent_oauth_tokens (token_hash, grant_id, kind, pair_id, expires_at)
    values (p_access_hash, p_grant_id, 'access', new_pair_id, access_expires_at);

  access_expires_in := floor(extract(epoch from access_expires_at - now()))::int;
  refresh_expires_at := null;

  if p_refresh_hash is not null then
    refresh_expires_at := least(now() + c_refresh_idle_ttl, p_grant_expires_at);
    insert into agent_oauth_tokens (
      token_hash, grant_id, kind, pair_id, rotated_from_hash, expires_at
    ) values (
      p_refresh_hash, p_grant_id, 'refresh', new_pair_id, p_rotated_from_hash,
      refresh_expires_at
    );
  end if;
end;
$$;

revoke execute on function public.agent_oauth_issue_tokens (
  uuid, timestamptz, text, text, text
) from public, anon, authenticated, service_role;

-- ── internal: revoke a grant ───────────────────────────────────────────────
-- Revokes the grant if it is active and deletes its tokens either way, so a
-- revoked grant never holds tokens. Returns true when this call revoked it.
-- Not executable by any API role.
create or replace function public.agent_oauth_revoke_grant_row (
  p_grant_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  newly_revoked boolean;
begin
  update agent_oauth_grants g
    set revoked_at = now(), revoke_reason = p_reason
    where g.id = p_grant_id
      and g.revoked_at is null;
  newly_revoked := found;

  delete from agent_oauth_tokens t where t.grant_id = p_grant_id;

  return newly_revoked;
end;
$$;

revoke execute on function public.agent_oauth_revoke_grant_row (uuid, text)
  from public, anon, authenticated, service_role;

-- ── create_agent_oauth_code ────────────────────────────────────────────────
-- Stores a single-use authorization code after the user approves. Takes the
-- same per-user advisory lock as create_agent_token, so the cap check can't
-- race another approval or an exchange. The key-share lock on the client row
-- keeps cleanup from deleting the client until this commits; a client deleted
-- first is reported as invalid_client rather than as an FK error.
-- outcome: 'ok' | 'invalid_client' (the client was deleted since validation)
--        | 'grant_cap'.
create or replace function public.create_agent_oauth_code (
  p_user_id uuid,
  p_client_id text,
  p_code_hash text,
  p_redirect_uri text,
  p_code_challenge text,
  p_scopes text[],
  p_grant_expires_in interval,
  p_resource text,
  out outcome text,
  out expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c_code_ttl constant interval := interval '5 minutes';
begin
  perform pg_advisory_xact_lock(hashtext('agent_tokens:' || p_user_id::text));

  perform 1 from agent_oauth_clients c
    where c.client_id = p_client_id
    for key share;

  if not found then
    outcome := 'invalid_client';
    return;
  end if;

  if agent_oauth_grant_cap_reached(p_user_id, p_client_id) then
    outcome := 'grant_cap';
    return;
  end if;

  expires_at := now() + c_code_ttl;

  insert into agent_oauth_codes (
    code_hash, client_id, user_id, redirect_uri, code_challenge, scopes,
    grant_expires_in, resource, expires_at
  ) values (
    p_code_hash, p_client_id, p_user_id, p_redirect_uri, p_code_challenge,
    p_scopes, p_grant_expires_in, p_resource, expires_at
  );

  outcome := 'ok';
end;
$$;

revoke execute on function public.create_agent_oauth_code (
  uuid, text, text, text, text, text[], interval, text
) from public, anon, authenticated;

grant execute on function public.create_agent_oauth_code (
  uuid, text, text, text, text, text[], interval, text
) to service_role;

-- ── exchange_agent_oauth_code ──────────────────────────────────────────────
-- Exchanges a code for a new grant and its tokens. The caller has already
-- authenticated the client and verified PKCE and the redirect URI, so a reused
-- code here comes from the client itself (or a thief holding its credentials
-- and verifier), and revoking the grant it produced is safe. Reuse is checked
-- before expiry, so a code replayed after it expired still revokes its grant.
--
-- Lock order: the per-user advisory lock, the client row, then the code row.
-- Cleanup deletes clients (cascading to their codes) before it deletes
-- expired codes, so it also takes client rows before code rows, and the two
-- can't deadlock.
-- outcome: 'ok' | 'invalid_grant' (missing, another client's, expired, its
--          client deleted, or a grant lifetime too short to issue tokens for)
--        | 'code_reuse' (already used; its grant is now revoked)
--        | 'grant_cap'.
create or replace function public.exchange_agent_oauth_code (
  p_code_hash text,
  p_client_id text,
  p_access_hash text,
  p_refresh_hash text,
  p_issue_refresh boolean,
  out outcome text,
  out grant_id uuid,
  out user_id uuid,
  out client_name text,
  out scopes text[],
  out access_expires_in int,
  out refresh_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  c_min_grant_remaining constant interval := interval '60 seconds';
  code_user_id uuid;
  code_row agent_oauth_codes%rowtype;
  new_grant agent_oauth_grants%rowtype;
  issued record;
begin
  if p_issue_refresh and p_refresh_hash is null then
    raise exception 'p_refresh_hash is required when p_issue_refresh is set';
  end if;

  -- The lock key needs the user, and the lock must be taken before the row
  -- lock, so the first read is unlocked and the row is re-read below.
  select c.user_id into code_user_id
    from agent_oauth_codes c
    where c.code_hash = p_code_hash;

  if code_user_id is null then
    outcome := 'invalid_grant';
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('agent_tokens:' || code_user_id::text));

  -- No-key-update conflicts with cleanup's delete of the client but not with
  -- the key-share locks that FK checks and create_agent_oauth_code take.
  perform 1 from agent_oauth_clients c
    where c.client_id = p_client_id
    for no key update;

  if not found then
    outcome := 'invalid_grant';
    return;
  end if;

  select * into code_row
    from agent_oauth_codes c
    where c.code_hash = p_code_hash
    for update;

  if not found or code_row.client_id is distinct from p_client_id then
    outcome := 'invalid_grant';
    return;
  end if;

  if code_row.used_at is not null then
    if code_row.grant_id is not null then
      perform agent_oauth_revoke_grant_row(code_row.grant_id, 'code_reuse');
    end if;
    outcome := 'code_reuse';
    grant_id := code_row.grant_id;
    return;
  end if;

  -- A grant with under a minute left would get an expires_in of 0 and a dead
  -- refresh token. A null lifetime (never expires) passes.
  if code_row.expires_at <= now()
    or code_row.grant_expires_in <= c_min_grant_remaining
  then
    outcome := 'invalid_grant';
    return;
  end if;

  if agent_oauth_grant_cap_reached(code_row.user_id, code_row.client_id) then
    outcome := 'grant_cap';
    return;
  end if;

  -- Any unrevoked grant for this pair, active or expired, holds the partial
  -- unique index, so it is replaced.
  perform agent_oauth_revoke_grant_row(g.id, 'replaced')
    from agent_oauth_grants g
    where g.user_id = code_row.user_id
      and g.client_id = code_row.client_id
      and g.revoked_at is null;

  insert into agent_oauth_grants as g
    (user_id, client_id, client_name, resource, scopes, expires_at)
  select
    code_row.user_id, c.client_id, c.client_name, code_row.resource,
    code_row.scopes, now() + code_row.grant_expires_in
  from agent_oauth_clients c
  where c.client_id = code_row.client_id
  returning g.* into new_grant;

  update agent_oauth_codes c
    set used_at = now(), grant_id = new_grant.id
    where c.code_hash = p_code_hash;

  select * into issued
    from agent_oauth_issue_tokens(
      new_grant.id,
      new_grant.expires_at,
      p_access_hash,
      case when p_issue_refresh then p_refresh_hash end,
      null
    );

  update agent_oauth_clients c
    set first_authorized_at = now()
    where c.client_id = code_row.client_id
      and c.first_authorized_at is null;

  outcome := 'ok';
  grant_id := new_grant.id;
  user_id := new_grant.user_id;
  client_name := new_grant.client_name;
  scopes := new_grant.scopes;
  access_expires_in := issued.access_expires_in;
  refresh_expires_at := issued.refresh_expires_at;
end;
$$;

revoke execute on function public.exchange_agent_oauth_code (
  text, text, text, text, boolean
) from public, anon, authenticated;

grant execute on function public.exchange_agent_oauth_code (
  text, text, text, text, boolean
) to service_role;

-- ── rotate_agent_oauth_refresh ─────────────────────────────────────────────
-- Rotates a refresh token: consumes it and issues a new access and refresh
-- pair, whose refresh token records the presented one in rotated_from_hash.
-- Locking the grant row serializes refreshes per grant.
--
-- A consumed token presented again within the grace window is a concurrent
-- refresh by the same client (RFC 9700 §4.14.2), as long as none of its
-- successors has been used. It gets a fresh pair, and every unconsumed
-- successor issued for it so far is superseded and loses its access token.
-- So each consumed token has at most one live successor chain, and an
-- attacker racing the client can't keep a chain of its own alive.
--
-- Reuse revokes the grant and deletes its tokens. It is any of:
-- - a superseded token
-- - a consumed token presented after the grace window
-- - a consumed token with a successor that has itself been consumed
-- - a consumed token past the reissue limit
--
-- A grant with under a minute left gets invalid_grant, so expires_in is never
-- 0 and no dead refresh token is issued. So does an expired token, including
-- a consumed one inside the grace window (after the reuse checks above).
-- outcome: 'ok' | 'invalid_grant' | 'refresh_reuse' (the grant is now revoked).
create or replace function public.rotate_agent_oauth_refresh (
  p_refresh_hash text,
  p_client_id text,
  p_new_access_hash text,
  p_new_refresh_hash text,
  out outcome text,
  out grant_id uuid,
  out user_id uuid,
  out scopes text[],
  out access_expires_in int,
  out refresh_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  c_grace_window constant interval := interval '60 seconds';
  c_max_grace_reissues constant int := 5;
  c_min_grant_remaining constant interval := interval '60 seconds';
  token_grant_id uuid;
  grant_row agent_oauth_grants%rowtype;
  token_row agent_oauth_tokens%rowtype;
  is_reuse boolean;
  issued record;
begin
  if p_new_access_hash is null or p_new_refresh_hash is null then
    raise exception 'p_new_access_hash and p_new_refresh_hash are required';
  end if;

  select t.grant_id into token_grant_id
    from agent_oauth_tokens t
    where t.token_hash = p_refresh_hash;

  if token_grant_id is null then
    outcome := 'invalid_grant';
    return;
  end if;

  select * into grant_row
    from agent_oauth_grants g
    where g.id = token_grant_id
    for update;

  -- Re-read under the grant lock: a concurrent reuse may have deleted it.
  select * into token_row
    from agent_oauth_tokens t
    where t.token_hash = p_refresh_hash;

  if grant_row.id is null
    or token_row.token_hash is null
    or token_row.kind <> 'refresh'
    or grant_row.client_id is distinct from p_client_id
  then
    outcome := 'invalid_grant';
    return;
  end if;

  if grant_row.revoked_at is not null
    or grant_row.expires_at <= now() + c_min_grant_remaining
  then
    outcome := 'invalid_grant';
    return;
  end if;

  if token_row.superseded_at is not null then
    is_reuse := true;
  elsif token_row.consumed_at is not null then
    is_reuse := token_row.consumed_at <= now() - c_grace_window
      or token_row.grace_reissues >= c_max_grace_reissues
      or exists (
        select 1 from agent_oauth_tokens s
          where s.rotated_from_hash = p_refresh_hash
            and s.consumed_at is not null
      );
  elsif token_row.expires_at <= now() then
    outcome := 'invalid_grant';
    return;
  else
    is_reuse := false;
  end if;

  if is_reuse then
    perform agent_oauth_revoke_grant_row(grant_row.id, 'refresh_reuse');
    outcome := 'refresh_reuse';
    grant_id := grant_row.id;
    return;
  end if;

  -- A consumed token that has expired since gets no grace reissue. Checked
  -- after reuse detection, so a superseded or replayed token still revokes.
  if token_row.consumed_at is not null and token_row.expires_at <= now() then
    outcome := 'invalid_grant';
    return;
  end if;

  if token_row.consumed_at is not null then
    -- Grace reissue. No successor is consumed (checked above), so superseding
    -- the unsuperseded ones leaves only the pair issued below live.
    with superseded as (
      update agent_oauth_tokens s
        set superseded_at = now()
        where s.rotated_from_hash = p_refresh_hash
          and s.superseded_at is null
        returning s.pair_id
    )
    delete from agent_oauth_tokens a
      using superseded
      where a.grant_id = grant_row.id
        and a.pair_id = superseded.pair_id
        and a.kind = 'access';

    update agent_oauth_tokens t
      set grace_reissues = t.grace_reissues + 1
      where t.token_hash = p_refresh_hash;
  else
    update agent_oauth_tokens t
      set consumed_at = now()
      where t.token_hash = p_refresh_hash;
  end if;

  select * into issued
    from agent_oauth_issue_tokens(
      grant_row.id,
      grant_row.expires_at,
      p_new_access_hash,
      p_new_refresh_hash,
      p_refresh_hash
    );

  update agent_oauth_grants g
    set last_used_at = now()
    where g.id = grant_row.id;

  delete from agent_oauth_tokens t
    where t.grant_id = grant_row.id
      and t.kind = 'access'
      and t.expires_at <= now();

  outcome := 'ok';
  grant_id := grant_row.id;
  user_id := grant_row.user_id;
  scopes := grant_row.scopes;
  access_expires_in := issued.access_expires_in;
  refresh_expires_at := issued.refresh_expires_at;
end;
$$;

revoke execute on function public.rotate_agent_oauth_refresh (
  text, text, text, text
) from public, anon, authenticated;

grant execute on function public.rotate_agent_oauth_refresh (
  text, text, text, text
) to service_role;

-- ── revoke_agent_oauth_grant ───────────────────────────────────────────────
-- Revokes one of the user's grants. Idempotent.
-- outcome: 'revoked' | 'already_revoked' | 'not_found' (missing or another
-- user's). grant_id is null for not_found.
create or replace function public.revoke_agent_oauth_grant (
  p_grant_id uuid,
  p_user_id uuid,
  p_reason text,
  out outcome text,
  out grant_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not exists (
    select 1 from agent_oauth_grants g
      where g.id = p_grant_id and g.user_id = p_user_id
  ) then
    outcome := 'not_found';
    return;
  end if;

  grant_id := p_grant_id;
  if agent_oauth_revoke_grant_row(p_grant_id, p_reason) then
    outcome := 'revoked';
  else
    outcome := 'already_revoked';
  end if;
end;
$$;

revoke execute on function public.revoke_agent_oauth_grant (uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.revoke_agent_oauth_grant (uuid, uuid, text)
  to service_role;

-- ── revoke_all_agent_oauth_grants ──────────────────────────────────────────
-- Revokes every active grant the user has and deletes their tokens. Takes the
-- per-user lock so an exchange in flight can't add a grant after it. Idempotent.
-- Returns the number of grants this call revoked.
create or replace function public.revoke_all_agent_oauth_grants (
  p_user_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  revoked_count int;
begin
  perform pg_advisory_xact_lock(hashtext('agent_tokens:' || p_user_id::text));

  update agent_oauth_grants g
    set revoked_at = now(), revoke_reason = 'user_all'
    where g.user_id = p_user_id
      and g.revoked_at is null;
  get diagnostics revoked_count = row_count;

  delete from agent_oauth_tokens t
    using agent_oauth_grants g
    where t.grant_id = g.id
      and g.user_id = p_user_id;

  return revoked_count;
end;
$$;

revoke execute on function public.revoke_all_agent_oauth_grants (uuid)
  from public, anon, authenticated;

grant execute on function public.revoke_all_agent_oauth_grants (uuid)
  to service_role;

-- ── revoke_agent_oauth_token ───────────────────────────────────────────────
-- RFC 7009: revokes the whole grant when the token (access or refresh) belongs
-- to p_client_id, and otherwise does nothing.
-- outcome: 'revoked' | 'already_revoked' | 'not_found' (unknown, or another
-- client's token).
create or replace function public.revoke_agent_oauth_token (
  p_token_hash text,
  p_client_id text,
  out outcome text,
  out grant_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  token_grant_id uuid;
begin
  select g.id into token_grant_id
    from agent_oauth_tokens t
    join agent_oauth_grants g on g.id = t.grant_id
    where t.token_hash = p_token_hash
      and g.client_id = p_client_id;

  if token_grant_id is null then
    outcome := 'not_found';
    return;
  end if;

  grant_id := token_grant_id;
  if agent_oauth_revoke_grant_row(token_grant_id, 'client') then
    outcome := 'revoked';
  else
    outcome := 'already_revoked';
  end if;
end;
$$;

revoke execute on function public.revoke_agent_oauth_token (text, text)
  from public, anon, authenticated;

grant execute on function public.revoke_agent_oauth_token (text, text)
  to service_role;

-- ── delete_expired_agent_oauth_rows ────────────────────────────────────────
-- Daily cleanup (app/api/cron/agent-oauth-cleanup).
-- - Revokes grants that never expire and have been idle for the idle window,
--   and deletes their tokens, so re-registered clients don't pile up against
--   the cap.
-- - Deletes clients that never authorized within the unused-client window.
--   A client with any grant is kept (the grants FK is on delete restrict).
-- - Deletes codes and tokens past their expiry by more than the retention
--   period. Consumed and superseded refresh tokens stay until their own
--   expiry, so reuse is detected for as long as the token could have been
--   used.
create or replace function public.delete_expired_agent_oauth_rows (
  out idle_grants_revoked int,
  out codes_deleted int,
  out access_tokens_deleted int,
  out refresh_tokens_deleted int,
  out clients_deleted int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  c_retention_after_expiry constant interval := interval '1 day';
  c_unused_client_ttl constant interval := interval '24 hours';
  c_idle_grant_ttl constant interval := interval '30 days';
begin
  -- Grants locked by a refresh, touch or revocation in flight are skipped
  -- until the next run. Locking re-checks the idle test against the latest
  -- row version, and the update re-checks it again, so a grant used since
  -- this statement began is kept.
  with idle as (
    select g.id
      from agent_oauth_grants g
      where g.revoked_at is null
        and g.expires_at is null
        and g.last_used_at < now() - c_idle_grant_ttl
      order by g.id
      for update skip locked
  ),
  revoked as (
    update agent_oauth_grants g
      set revoked_at = now(), revoke_reason = 'idle'
      from idle
      where g.id = idle.id
        and g.revoked_at is null
        and g.expires_at is null
        and g.last_used_at < now() - c_idle_grant_ttl
      returning g.id
  ),
  revoked_tokens as (
    delete from agent_oauth_tokens t
      using revoked
      where t.grant_id = revoked.id
  )
  select count(*) into idle_grants_revoked from revoked;

  -- Before the code delete, so cleanup locks client rows before code rows
  -- (this cascades to the client's codes), the order the exchange uses. A
  -- first exchange in flight holds a no-key-update lock on the client row and
  -- sets first_authorized_at, so this delete waits for it and then skips the
  -- client when it re-checks the updated row.
  delete from agent_oauth_clients c
    where c.first_authorized_at is null
      and c.created_at < now() - c_unused_client_ttl
      and not exists (
        select 1 from agent_oauth_grants g where g.client_id = c.client_id
      );
  get diagnostics clients_deleted = row_count;

  delete from agent_oauth_codes c
    where c.expires_at < now() - c_retention_after_expiry;
  get diagnostics codes_deleted = row_count;

  delete from agent_oauth_tokens t
    where t.kind = 'access'
      and t.expires_at < now() - c_retention_after_expiry;
  get diagnostics access_tokens_deleted = row_count;

  -- Consumed, superseded or neither: each refresh token is kept until a day
  -- past its own expiry.
  delete from agent_oauth_tokens t
    where t.kind = 'refresh'
      and t.expires_at < now() - c_retention_after_expiry;
  get diagnostics refresh_tokens_deleted = row_count;
end;
$$;

revoke execute on function public.delete_expired_agent_oauth_rows ()
  from public, anon, authenticated;

grant execute on function public.delete_expired_agent_oauth_rows ()
  to service_role;

commit;
