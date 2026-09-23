# PRD: OAuth 2.1 sign-in for the CareerOtter MCP server

Extends PR #226 (`.claude/ship/mcp-PRD.md`).

Decisions made with the user:
- Personal access tokens (PATs) stay. OAuth is a second way to reach the same
  `/api/mcp` route, because scripts, cron jobs and server-side harnesses can't
  complete a browser sign-in.
- CareerOtter runs its own OAuth 2.1 authorization server, rather than Supabase
  Auth's OAuth server. See "Why not Supabase Auth's OAuth server".

## Problem Statement

The MCP server only accepts `co_pat_` bearer tokens, which a user creates on
`/dashboard/data` and pastes into a client config.

- Claude.ai custom connectors can't use a pasted token at all. They only support
  the MCP authorization flow: discover an authorization server, register, send
  the user through a browser sign-in and consent, then call the server with the
  token they receive.
- Claude Desktop needs the `mcp-remote` wrapper.
- Claude Code and Cursor work, but setup means creating a token, copying it and
  editing a config file.

Users who live in Claude.ai can't connect at all, and the connect-by-URL
experience other MCP integrations offer is missing.

Why now: the MCP server is about to launch (PR #226), and connecting by URL is
what people will try first.

## Goals

1. A user adds CareerOtter to Claude.ai, Claude Desktop, Claude Code or Cursor by
   URL alone (`https://careerotter.io/api/mcp`) and approves access in the
   browser, choosing scopes and an expiry under the same rules as a token.
2. An OAuth-issued token can do exactly what a PAT with the same scopes can do,
   and nothing else:
   - it works only at `/api/mcp`
   - it isn't a Supabase credential, so it can't touch the Data API, Storage,
     Auth endpoints or the app's own routes
3. Revoking a connected app on `/dashboard/data` blocks its next request
   (access and refresh tokens alike).
4. Everything stays dark until both `CAREEROTTER_ENABLED=1` and
   `CAREEROTTER_MCP_OAUTH_ENABLED=1`. With the second flag off, PR #226 behaves
   exactly as it does today, and every 401 is byte-identical.
5. No regression for PAT clients, the web app or the browser extension.

Acceptance: each goal maps to automated tests in the task breakdown. Goal 2's
"nothing else" is covered by negative tests: an OAuth token is rejected by
Supabase clients, by the app's cookie routes and by every non-MCP bearer check.

## Non-Goals

- **Supabase Auth's OAuth 2.1 server.** Rejected; see below. The user should
  turn it and dynamic registration back off in the dashboard.
- **OpenID Connect.** No ID tokens and no `openid-configuration`. MCP needs
  OAuth only.
- **Client ID Metadata Documents** (the 2025-11-25 spec's preferred
  registration). v1 supports dynamic registration only. Whether each target
  client registers that way is checked in the launch test. CIMD is a follow-up.
- **JWT access tokens.** Tokens are opaque, stored hashed, and looked up like
  PATs.
- **Upgrading `@supabase/supabase-js`.** Supabase's OAuth methods aren't used,
  so there's no need. The upgrade was measured as clean (no new tsc errors, the
  same jest results) and can ship separately.
- **Emailing the user when an app connects.** A follow-up, as for tokens.
- **Carrying the flow through a paid-plan checkout during onboarding.** A new
  user who picks a paid plan while onboarding goes through Stripe and comes back
  to the dashboard. They then reconnect from their app. Sign-up itself (email
  or Google) and free onboarding do carry the flow; see "Consent screen".
- **Fixing pre-existing policy issues found during discovery.** Reported to the
  user, not changed here:
  - the `allow all i5g8va_*` storage policies
  - users being able to insert and update their own `user_subscriptions` rows

## Why not Supabase Auth's OAuth server

Supabase's OAuth server issues ordinary Supabase user JWTs with a `client_id`
claim. It doesn't support custom scopes, so every token carries the user's full
power. Checked against Supabase Auth's source (`supabase/auth` master,
2026-09-23):

- **Account endpoints.** `requireAuthentication` on `/user`,
  `/user/identities`, `/factors`, `/logout` and the OAuth consent and grant
  endpoints verifies only the signature and that the session exists. No handler
  checks `client_id`.
- **Passwords.** In `user.go`, the current-password check runs only when the
  user already has a password, and the reauthentication check is skipped for
  sessions under 24 hours old. An approved app, or anyone holding a leaked
  token, could set a password on a Google-only account and then sign in to the
  web app as the user.
- **What we could and couldn't block.** We could block the Data API and Storage
  (a pre-request hook and a restrictive policy) and our own cookie routes, but
  not Supabase Auth's own endpoints. A Custom Access Token Hook can't help:
  `role` is limited to `anon` or `authenticated`, and GoTrue doesn't check
  `aud`.

With our own server, a token is a random string whose only meaning is a row in
our database that lists MCP scopes. A leaked token exposes at most the scopes
the user approved, and only through `/api/mcp`.

## User Stories

1. As a Claude.ai user, I want to add CareerOtter as a custom connector by
   pasting its URL, so that I can log wins and ask about my comp from any chat
   without handling a token.
2. As a user approving a connection, I want to see which app is asking, where it
   will send me back, and to choose which data it gets and for how long, so that
   I only grant what I intend.
3. As a user who connected an app I no longer trust, I want to revoke it on
   `/dashboard/data` and have it lose access at once, so that a leaked or
   misbehaving client can't keep using my data.
4. As a Claude Code user, I want to run
   `claude mcp add --transport http careerotter https://careerotter.io/api/mcp`
   and sign in when prompted, so that I don't have to keep a token in my shell
   profile.
5. As a user with a nightly script, I want my personal token to keep working
   unchanged, so that adding OAuth doesn't break my automation.
6. As the operator, I want OAuth off until I flip a flag after the launch
   checks, so that nothing is reachable early.

## Technical Approach

### Overview

CareerOtter itself becomes the OAuth 2.1 authorization server (AS) for one
protected resource, `/api/mcp`. Users authenticate to the AS with their existing
Supabase cookie session; Supabase is used only to establish who is signed in,
as it is in the rest of the app. The AS issues opaque access and refresh tokens,
stored as SHA-256 hashes. The MCP route verifies an access token by hash lookup
and loads the scopes from its grant, alongside the PAT path.

Endpoints. The issuer is `SITE_URL`, which comes from `NEXT_PUBLIC_APP_URL` and
defaults to `https://careerotter.io`.

| Purpose | Path | Spec |
|---|---|---|
| Protected resource metadata | `GET /.well-known/oauth-protected-resource/api/mcp` and `GET /.well-known/oauth-protected-resource` (root fallback, same body) | RFC 9728 |
| AS metadata | `GET /.well-known/oauth-authorization-server` | RFC 8414 |
| Dynamic client registration | `POST /api/oauth/register` | RFC 7591 |
| Authorization request | `GET /oauth/authorize` (route handler: validates, then redirects) | OAuth 2.1 §4.1 |
| Consent screen | `GET /oauth/consent` (page) | internal |
| Consent decision | `POST /api/oauth/authorize` | internal |
| Token | `POST /api/oauth/token` | OAuth 2.1 §4.1.3, §4.3 |
| Revocation | `POST /api/oauth/revoke` | RFC 7009 |

What we reuse and what we write:
- From the MCP SDK 1.26 already in the repo, the zod schemas in
  `@modelcontextprotocol/sdk/shared/auth.js` (`OAuthClientMetadataSchema`,
  `OAuthMetadataSchema`, `OAuthProtectedResourceMetadataSchema`,
  `OAuthTokensSchema`) and the OAuth error classes in `server/auth/errors.js`.
- The SDK's Express request handlers can't run in Next.js route handlers, so
  the handlers are ours.

Supported clients:
- Clients with a server or native component: Claude.ai (server-side), Claude
  Desktop, Claude Code, Cursor, and MCP Inspector's OAuth flow.
- Not browser-only clients that call `/api/mcp` directly. The route keeps
  answering OPTIONS with 405 and a foreign `Origin` with 403, because DNS
  rebinding protection requires it.
- The AS endpoints do send CORS headers, so a browser-based OAuth flow (such as
  Inspector's) can complete.

### Flow

1. The client POSTs to `/api/mcp` without a token and gets a 401 with
   `WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource/api/mcp", scope="wins:read wins:write"`.
   The `scope` hint makes SDK-based clients request the PAT defaults, not every
   scope we support.
2. The client fetches that document, which says
   `authorization_servers: ["https://careerotter.io"]`, then fetches
   `/.well-known/oauth-authorization-server`.
3. It registers at `/api/oauth/register` and gets a `client_id`.
4. It opens `/oauth/authorize?…` with PKCE S256. The route handler validates the
   request, then redirects to login (if needed) or to `/oauth/consent?…`.
5. The user reviews the app, picks scopes and an expiry, and approves. We
   create a single-use code, and the browser goes to
   `redirect_uri?code=…&state=…&iss=https://careerotter.io`.
6. The client exchanges the code and its verifier at `/api/oauth/token` for a
   `co_oat_` access token and a `co_ort_` refresh token.
7. It calls `/api/mcp` with the access token. The route looks up the hash and
   registers tools for the grant's scopes.
8. It refreshes before the access token expires. Every refresh rotates the
   refresh token, with a short grace window for concurrent refreshes.

### Token and code formats

These use the same construction as PATs (`lib/auth/agent-token.ts`): a prefix,
then base64url of 32 random bytes, then `_` and a 7-character base36 CRC32
checksum. The checksum is only a cheap junk filter that runs before any
database lookup.

| Kind | Prefix | Lifetime | Stored as |
|---|---|---|---|
| Access token | `co_oat_` | `min(24 hours, grant expiry)` | SHA-256 hex |
| Refresh token | `co_ort_` | `min(grant expiry, last use + 30 days)` | SHA-256 hex |
| Authorization code | `co_code_` | 5 minutes, single use | SHA-256 hex |
| Client secret (confidential clients only) | `co_cs_` | none | SHA-256 hex |
| Client id | `co_client_` + base64url(16 random bytes) | life of the registration | plain (public identifier) |

The generator is generalized from `generateAgentToken` into
`generatePrefixedSecret(prefix)`, `hasValidPrefixedSecretFormat(raw, prefix)`
and `hashSecret(raw)`. The PAT functions become thin wrappers; their behavior
and tests don't change.

The grant lifetime the user chooses is passed to the database as an interval.
The fixed lifetimes (access, refresh, code, grace window, the minimum a grant
must have left, retention, idle) are
`constant interval` declarations inside the functions, mirrored by
`AGENT_OAUTH_LIFETIME_SECONDS` in `lib/constants/agent-oauth.ts` and guarded by
a test. Every timestamp is computed in the database with `now()`, so one clock
decides all expiries.

### Data model: `schemas/migrations/045_mcp_oauth.sql` (one transaction)

All tables have RLS enabled with no policies, so only the service role can use
them, as with `agent_tokens`. All functions are `security definer`, set
`search_path = public`, revoke EXECUTE from public, `anon` and `authenticated`,
and grant it to `service_role` only. Three internal helpers
(`agent_oauth_grant_cap_reached`, `agent_oauth_issue_tokens`,
`agent_oauth_revoke_grant_row`) hold the cap, the token-pair insert and the
revoke-and-delete-tokens step once; they are executable by no API role, not
even `service_role`. `agent_oauth_max_char_length(text[])` is an immutable
helper for the `redirect_uris` CHECK.

Every public function reports expected results in an `outcome` column (or a
count) and never raises for them; it raises only on programming errors (a
CHECK or FK failure) and when a lock wait passes its `lock_timeout`.

**Lock waits.** The functions the endpoints call that wait for the per-user
advisory lock or a row lock (`create_agent_oauth_code`,
`exchange_agent_oauth_code`, `rotate_agent_oauth_refresh`,
`revoke_agent_oauth_grant`, `revoke_all_agent_oauth_grants`,
`revoke_agent_oauth_token`) `set lock_timeout = '3s'`
(`AGENT_OAUTH_DB_LOCK_TIMEOUT_SECONDS`). A stuck lock then fails the call with
SQLSTATE 55P03, which the endpoint answers with 503 `temporarily_unavailable`,
and the transaction rolls back, so nothing was consumed. TypeScript never
aborts these calls itself: a cancelled exchange or rotation could have
committed without the client learning its new tokens. The token endpoint's
side-effect-free lookups (the client, the code, the refresh token) are
aborted after `AGENT_OAUTH_DEADLINES_MS.dbRead` (5 s), with the same 503.

`agent_oauth_clients`:
- `client_id text primary key`, CHECK `^co_client_[A-Za-z0-9_-]{22}$`
- `client_secret_hash text null` (64 hex); CHECK that it's set exactly when
  `token_endpoint_auth_method` isn't `none`
- `token_endpoint_auth_method text not null`, CHECK in
  `('none','client_secret_basic','client_secret_post')`
- `grant_types text[] not null`: non-empty and a subset of
  `{authorization_code, refresh_token}`; `authorization_code` is required
- `client_name text not null`: 1–100 code points, checked with
  `char_length`, which counts code points
- `client_uri text null`: at most 512 characters, https only
- `redirect_uris text[] not null`: 1–5 non-null, non-empty entries, each at
  most 512 characters. Their content is validated in code.
- `created_at timestamptz not null default now()`
- `first_authorized_at timestamptz null`: set by `exchange_agent_oauth_code`
  on first success
- Index on `created_at` for cleanup

`agent_oauth_grants`, one row per approved connection:
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references public.profiles(id) on delete cascade`,
  matching `agent_tokens`
- `client_id text not null references agent_oauth_clients(client_id) on delete restrict`.
  Clients that have grants are never deleted by cleanup.
- `client_name text not null`: a snapshot for the list, so it survives client
  cleanup
- `resource text not null`: the canonical resource URL the grant is for
- `scopes text[] not null`: the same CHECK as `agent_tokens.scopes`, with write
  implying read
- `expires_at timestamptz null`: required when a comp scope is present, as for
  PATs
- `created_at`, `last_used_at timestamptz not null default now()`,
  `revoked_at timestamptz null`
- `revoke_reason text null`: CHECK in
  `('user','user_all','client','replaced','refresh_reuse','code_reuse','idle')`.
  `client` is a revocation by the client at the RFC 7009 endpoint. CHECK that
  `revoke_reason` is set exactly when `revoked_at` is.
- Partial unique index on `(user_id, client_id) where revoked_at is null`
- Index on `(user_id, created_at desc)`, and on `client_id` (backs the
  restrict check when cleanup deletes clients)

`agent_oauth_tokens`:
- `token_hash text primary key` (64 hex)
- `grant_id uuid not null references agent_oauth_grants(id) on delete cascade`
- `kind text not null`: CHECK in `('access','refresh')`
- `pair_id uuid not null`: shared by the access and refresh tokens issued
  together, so superseding a refresh token can delete its access token
- `rotated_from_hash text null` (64 hex): on refresh tokens issued by
  rotation, the hash of the refresh token that was presented; null for tokens
  issued at code exchange. Not a foreign key, since cleanup may delete the
  parent first.
- `expires_at timestamptz not null`, `created_at timestamptz not null default now()`
- `consumed_at timestamptz null`: set on refresh tokens that have been rotated
- `superseded_at timestamptz null`: set on an unconsumed refresh token when a
  grace reissue for its parent replaces it. Presenting it afterwards is reuse.
- `grace_reissues int not null default 0`, CHECK between 0 and 5: extra pairs
  issued for this consumed token inside the grace window.
- CHECK that only refresh tokens have `consumed_at`, `superseded_at`,
  `rotated_from_hash` or a non-zero `grace_reissues`, and that no token is both
  consumed and superseded.
- Index on `(grant_id)`, on `expires_at`, and a partial index on
  `rotated_from_hash` (finds a token's successors)

`agent_oauth_codes`:
- `code_hash text primary key`
- `client_id text not null references agent_oauth_clients on delete cascade`
- `user_id uuid not null references public.profiles(id) on delete cascade`
- `redirect_uri text not null`: the registered URI that matched, stored
  exactly as registered
- `code_challenge text not null`, CHECK `^[A-Za-z0-9_-]{43}$`
- `scopes text[] not null`: the same CHECK as grants
- `grant_expires_in interval null`, CHECK `> 0` and `<= 365 days` (the longest
  PAT expiry option, `AGENT_OAUTH_LIMITS.grantExpiresInMaxDays`; the bound also
  rejects an infinite interval): the chosen grant lifetime; null means the
  grant never expires. Required when a comp scope is present.
- `resource text not null`: the canonical resource. When the request had no
  `resource` parameter, this is the `SITE_URL` resource.
- `created_at`, `expires_at timestamptz not null`, `used_at timestamptz null`
- `grant_id uuid null references agent_oauth_grants(id) on delete set null`:
  set by the exchange, so reusing the code can revoke the grant
- Index on `expires_at` (cleanup) and on `client_id` (the cascade when cleanup
  deletes clients)

**`create_agent_oauth_code(p_user_id, p_client_id, p_code_hash, p_redirect_uri, p_code_challenge, p_scopes, p_grant_expires_in, p_resource)`**
→ `(outcome, expires_at)`, outcome `ok | invalid_client | grant_cap`
- Takes the per-user advisory lock, the same one `create_agent_token` uses.
- Locks the client row `for key share`, so cleanup can't delete it until the
  code is stored, and returns `invalid_client` if the client was deleted since
  validation (rather than failing on the foreign key).
- Refuses with `grant_cap` when the user already has 10 active grants and none
  of them is for this client.
- Inserts the code and sets its expiry to `now() + interval '5 minutes'`.

**`exchange_agent_oauth_code(p_code_hash, p_client_id, p_access_hash, p_refresh_hash, p_issue_refresh boolean)`**
→ `(outcome, grant_id, user_id, client_name, scopes, access_expires_in, refresh_expires_at)`,
outcome `ok | invalid_grant | code_reuse | grant_cap`. TypeScript maps
`code_reuse` to `invalid_grant` and logs it.
1. Reads the code's `user_id` without locking, then takes the per-user
   advisory lock, locks the client row `for no key update` (returning
   `invalid_grant` if the client is gone), and re-reads the code `for update`.
   Cleanup deletes clients (cascading to their codes) before it deletes expired
   codes, so both take the client row before the code row and can't deadlock.
2. If the code is missing or belongs to another client, returns
   `invalid_grant`.
3. If the code has already been used, revokes `grant_id` with reason
   `code_reuse`, deletes its tokens and returns `code_reuse` with the grant id.
   This is checked before expiry, so a code replayed after it expired still
   revokes its grant. TypeScript only calls the function after the client has
   authenticated and PKCE has verified, so someone who only intercepted a code
   can't trigger this.
4. If the code has expired, or its grant lifetime is 60 seconds or less (the
   tokens would be dead on arrival), returns `invalid_grant`.
5. Re-checks the 10-grant cap, allowing a replacement for the same client, and
   returns `grant_cap` if the user is over it.
6. Revokes any unrevoked grant for this user and client (active or expired,
   since either holds the partial unique index) with reason `replaced`, and
   deletes its tokens.
7. Inserts the new grant with `expires_at = now() + grant_expires_in` and
   `client_name` copied from the client row.
8. Marks the code used and sets its `grant_id`.
9. Inserts the access token, with an expiry of `least(now() + 24h, grant expiry)`.
10. If `p_issue_refresh` is set, inserts the refresh token, with an expiry of
    `least(now() + 30 days, grant expiry)`, sharing the access token's
    `pair_id` and with a null `rotated_from_hash`.
11. Sets the client's `first_authorized_at` if it's null.
12. Returns the grant, the access token's remaining lifetime in whole seconds
    (for `expires_in`) and the refresh token's expiry (null when none was
    issued).

**`rotate_agent_oauth_refresh(p_refresh_hash, p_client_id, p_new_access_hash, p_new_refresh_hash)`**
→ `(outcome, grant_id, user_id, scopes, access_expires_in, refresh_expires_at)`,
outcome `ok | invalid_grant | refresh_reuse`. TypeScript maps `refresh_reuse`
to `invalid_grant` and logs it.
Raises (a programming error) if `p_new_access_hash` or `p_new_refresh_hash` is
null.
1. Reads the grant id without locking, then locks the grant row `for update`,
   which serializes refreshes for that grant.
2. If there is no token row, the token isn't a refresh token, or it belongs to
   another client's grant, returns `invalid_grant`. It revokes nothing.
3. If the grant has been revoked or expires within 60 seconds, returns
   `invalid_grant`, so `expires_in` is never 0 and no dead refresh token is
   issued.
4. Reuse: revoke the grant with reason `refresh_reuse`, delete its tokens and
   return `refresh_reuse`, when the presented token is any of:
   - superseded
   - consumed more than 60 seconds ago
   - consumed, with a successor (a row whose `rotated_from_hash` is the
     presented hash) that has itself been consumed
   - consumed, with `grace_reissues` already at 5
5. Grace reissue: a token consumed within the last 60 seconds that isn't reuse
   is a concurrent refresh by the same client (RFC 9700 §4.14.2). Set
   `superseded_at` on every unconsumed successor of the presented token, delete
   the access tokens that share those successors' `pair_id`, increment
   `grace_reissues`, and issue a new pair as in step 7. Each consumed token
   therefore has at most one live successor chain: the latest reissue. A
   client that loses the race and presents the superseded token revokes the
   grant, which is the price of not letting an attacker who races the client
   keep a chain of its own.
6. If the token has expired, returns `invalid_grant`: an unconsumed token, and
   also a consumed one inside the grace window (no reissue for it). This runs
   after the reuse checks in step 4, so an expired superseded or replayed
   token still revokes the grant.
7. Otherwise, and after a grace reissue:
   - sets `consumed_at` on the presented token (normal rotation only)
   - inserts the new access token (expires at `least(now() + 24h, grant expiry)`)
     and the new refresh token (expires at `least(now() + 30 days, grant expiry)`),
     sharing a new `pair_id`, with `rotated_from_hash` set to the presented hash
   - sets the grant's `last_used_at`
   - deletes this grant's access tokens that have expired

**`revoke_agent_oauth_grant(p_grant_id, p_user_id, p_reason)`** and
**`revoke_all_agent_oauth_grants(p_user_id)`** set `revoked_at` and
`revoke_reason`, and delete the grant's tokens. Both are idempotent.
- `revoke_agent_oauth_grant` returns `(outcome, grant_id)`, outcome
  `revoked | already_revoked | not_found` (missing or another user's);
  `grant_id` is null for `not_found`.
- `revoke_all_agent_oauth_grants` takes the per-user lock, so an exchange in
  flight can't add a grant after it, uses reason `user_all`, and returns the
  number of grants it revoked.

**`revoke_agent_oauth_token(p_token_hash, p_client_id)`** implements
RFC 7009: it revokes the whole grant (reason `client`) when the token belongs
to that client, and otherwise does nothing. It returns `(outcome, grant_id)`
with the same outcomes as `revoke_agent_oauth_grant`.

**`delete_expired_agent_oauth_rows()`** deletes:
- clients whose `first_authorized_at` is null, that are older than 24 hours,
  that have no grants and that have no unexpired code (a user may have just
  approved the client; deleting it would cascade to the code before the
  exchange). This runs before the code delete, so cleanup locks
  client rows before code rows, in the exchange's order. A first exchange in
  flight holds the client row lock and sets `first_authorized_at`, so the
  delete waits and then skips that client.
- codes more than a day past their expiry
- access tokens more than a day past their expiry
- refresh tokens more than a day past their expiry, whether consumed,
  superseded or neither. Consumed and superseded refresh tokens therefore stay
  until their own expiry (at most 30 days), so reuse is detected for as long
  as the token could have been used.

It also revokes, with reason `idle`, grants that never expire and haven't been
used for 30 days, and deletes their tokens. This keeps re-registered clients
from piling up against the cap. It is one set-based statement: it picks the
grants `order by id for update skip locked` (so a grant a request is using is
left for the next run), re-checks the idle test under the row lock, and
deletes the revoked grants' tokens in the same statement. It returns the count
for each rule.

Each rule handles at most 5,000 rows per call (`AGENT_OAUTH_CLEANUP.batchSize`,
a `limit` on each statement's selection), so a large backlog can't outrun the
statement timeout. The client delete repeats `first_authorized_at is null` and
the unexpired-code test outside its batch subquery, so they are re-checked on
the row version it waits for. The cron calls the function again while any
count comes back equal to the batch size, up to 10 calls
(`AGENT_OAUTH_CLEANUP.maxRounds`) per run; whatever is left waits for the next
day, with a warning log. A failed call ends the run with 500 and an
error-level log carrying the counts of the calls before it.

**Lookup at the MCP route.** One indexed select: the token joined to its grant,
filtered by `kind = 'access'`. It returns the grant id, user id, scopes and
`last_used_at`, plus the token's and grant's expiry and revocation, so the
caller can tell `active`, `expired`, `revoked` and `not_found` apart.

**Why access tokens last 24 hours.** A 1-hour access token is the norm for JWT
access tokens, because a short expiry is the only way to cut off a stolen JWT.
Our tokens are opaque, and every MCP request looks the token up in the
database, so revoking a grant takes effect on the next request whatever the
access token's expiry. A short lifetime would buy almost nothing and would
multiply refreshes.

**Row counts.** An active client refreshes about once a day. It leaves at most
about 30 consumed refresh tokens per grant (one a day, each kept until its
30-day expiry, so reuse is detected across the whole refresh lifetime) plus one
or two live tokens. Concurrent refreshes add at most 5 superseded rows per
consumed token, and are rare. That's roughly 5 KB per grant. The daily cleanup removes
rows once they expire.

045 has to run before the OAuth flag is turned on, but not before PR #226
deploys. With the flag off, no code reads these tables except revoke-all and
the cleanup cron, and both tolerate a missing function (see below).

### Registration: `POST /api/oauth/register`

- Only the fields we use are validated: `redirect_uris`, `grant_types`,
  `response_types`, `token_endpoint_auth_method` and `client_name`, plus
  `client_uri` (see below). Anything else (`logo_uri`, `tos_uri`, `jwks_uri`,
  `scope`, ...) is ignored, never echoed, and can never cause a rejection.
- Our redirect URI rules run first, on the raw strings. Then those fields go
  through `OAuthClientMetadataSchema` as a gate only: its output is never
  stored, because its URL parsing normalizes (lowercases the host, drops
  `:443`, resolves dot segments, encodes or trims whitespace). A schema
  failure on `redirect_uris` is `invalid_redirect_uri`; any other is
  `invalid_client_metadata`.
- **`redirect_uris`:** stored and echoed exactly as the client sent them, so
  the same string matches at `/oauth/authorize`. 1–5 entries, each at most 512
  characters, absolute, with no fragment and no credentials (`user:pass@`).
  A URI with whitespace (including a space), a control character (C0, DEL or
  C1) or a lone surrogate is rejected before any parsing. Each must be one of:
  - an `https:` URL whose host isn't one of ours (on any port, in any case,
    and also with a trailing dot). "Ours" is every host that serves or
    redirects to the app: the accepted origins' hosts and the legacy
    `apptrack.ing` hosts that 301 here. A code must never land on our own
    site, where page analytics would capture it.
  - an `http:` URL whose host is exactly `127.0.0.1`, `[::1]` or `localhost`,
    with any port or none (RFC 8252 §7.3). The raw string must already be in
    that exact lowercase form (`http://127.0.0.1…`, `http://[::1]…`,
    `http://localhost…`): spellings a parser would rewrite to a loopback host
    (`127.1`, `0x7f000001`, `127.0.0.1.`, `[0:0:0:0:0:0:0:1]`,
    `HTTP://LOCALHOST`) are rejected, since loopback matching compares the
    host exactly.
  - a private-use scheme matching `^[a-z][a-z0-9+.-]{2,}$` that isn't in the
    denylist: `javascript`, `data`, `file`, `vbscript`, `about`, `blob`,
    `filesystem`, `http`, `https`, `ws`, `wss`, `mailto`, `tel`, `sms`,
    `intent`, `chrome`, `chrome-extension`, `moz-extension`, `ftp`
- **`grant_types`:** a subset of `authorization_code` and `refresh_token`, and
  must include `authorization_code`. It's stored. The default is both.
- **`response_types`:** must be `["code"]` or omitted.
- **`token_endpoint_auth_method`:** `none` (the default), `client_secret_basic`
  or `client_secret_post`. The two secret methods get a `co_cs_` secret, which
  is returned once and stored hashed.
- **`client_name`:** NFC-normalized; control, format (zero-width, bidi marks
  and overrides, BOM, tag characters) and line/paragraph separator characters
  stripped; runs of more than 3 combining marks cut to 3; trimmed; then
  truncated to 100 graphemes without splitting one, and further until it is
  at most 100 code points (the column CHECK). "Unnamed app" when omitted or
  when no letter or digit is left.
- **`client_uri`:** kept, exactly as sent, only if it's a string, https, at
  most 512 characters, free of whitespace, control characters and lone
  surrogates, and a valid URL. Otherwise it's dropped; it never rejects the
  registration.
- **Response:** 201 with the RFC 7591 fields `client_id`, `client_id_issued_at`,
  `client_secret` and `client_secret_expires_at: 0` (confidential clients only),
  `redirect_uris`, `grant_types`, `response_types`, `token_endpoint_auth_method`
  and `client_name`.
- **Errors:** 400 `invalid_redirect_uri` or `invalid_client_metadata` in the
  RFC 7591 body, including for a non-JSON `Content-Type`, invalid JSON, or a
  body stream that fails midway (the client disconnected). Over the body cap →
  413 with the same body shape (`invalid_client_metadata`).
- **Rate limits** (Upstash, namespaced keys). Per-IP limits key an IPv6
  client on its /64, so rotating addresses within one allocation buys nothing:
  - 30 per IP per 10 minutes, generous because hosted clients register
    server-side from shared IPs
  - 100 per IP per day
  - 2,000 per day globally

  Registration fails closed with 503 (`temporarily_unavailable`, with
  `Retry-After`) if Redis is unconfigured, errors or takes over 2 seconds.
  Registration isn't latency-sensitive, and failing open would remove the only
  bound. Both per-IP buckets are charged first, for every request. The global
  bucket is charged only after validation passes, for a registration about to
  be stored, so neither an IP over its limit nor a malformed request spends
  the global quota. Over a limit → 429 with `Retry-After` and the token
  endpoint's body (`{ error: "invalid_request", error_description: "rate limited" }`).
- 16 KB body cap. POST and OPTIONS only (Next.js answers other methods with
  405).
- CORS: `Access-Control-Allow-Origin: *`, `Allow-Methods: POST, OPTIONS`,
  `Allow-Headers: Content-Type, Authorization, MCP-Protocol-Version`.
- Worst case, the global cap limits rows to 2,000 a day, each at most about
  3 KB. Clients that never authorize are purged after 24 hours.

### Authorization request: `GET /oauth/authorize` (route handler)

`app/oauth/authorize/route.ts` does the validation and redirecting, and never
renders HTML. Validation lives in one module used here, by the consent page and
by the POST (`lib/auth/oauth/authorize-params.ts`). It follows the split in
OAuth 2.1 §4.1.2.1.

1. **Fatal.** Any of these redirects to `/oauth/error` (a static card: "This
   connection link is invalid. Start again from your app."), never to the
   client:
   - `client_id` is unknown
   - `redirect_uri` is missing or doesn't match a URI registered for that
     client. Matching is exact string equality, except for loopback URIs, where
     scheme, host, path and query must match exactly and the port may differ
     (RFC 8252 §7.3).
2. **Redirect errors.** These redirect to the client's `redirect_uri` with
   `error`, `error_description`, `state` and `iss`:
   - `response_type` isn't `code` → `unsupported_response_type`
   - `code_challenge` is missing or isn't 43 base64url characters, or
     `code_challenge_method` isn't `S256` → `invalid_request`
   - `state` is longer than 512 bytes (UTF-8, not UTF-16 code units) →
     `invalid_request`
   - `resource` is present and doesn't normalize to an accepted MCP resource →
     `invalid_target`. Normalizing lowercases the scheme and host, drops a
     default port and drops one trailing slash; a resource over 512
     characters, or with a fragment or credentials, never normalizes. The
     accepted set is `<origin>/api/mcp` for each accepted origin.
   - `scope` is longer than 256 characters → `invalid_request`
   A repeated parameter is refused (RFC 6749 §3.1): a repeated `client_id` or
   `redirect_uri` is fatal, a repeated `resource` is `invalid_target`, and
   any other is `invalid_request`. An empty value counts as absent. `state`
   is echoed on an error only when it's a single value within the limit.
   If the client lookup itself fails, the user sees `/oauth/error` with an
   "unavailable" card (`?reason=unavailable`), and the POST answers 503.
3. **Scopes.** Unknown values (`openid`, `offline_access`, `profile`, …) are
   ignored, not rejected. Known values only affect what the consent screen
   shows as requested (see below).
4. **Next step.** The handler rebuilds a canonical query from the validated
   parameters with `URLSearchParams`: `response_type=code`, `client_id`,
   `redirect_uri` (as sent), `state`, `code_challenge`,
   `code_challenge_method=S256`, the normalized `resource` and `scope` (as
   sent, so the consent screen can label it). The two fixed values are
   carried so the consent page and the POST revalidate the query with the
   same validator, unchanged.
   - Signed out: redirect to `/login?redirectTo=` +
     `encodeURIComponent("/oauth/consent?" + canonicalQuery)`.
   - Signed in: redirect to `/oauth/consent?` + the canonical query.

   **URL budget.** Each level of nesting percent-encodes the one inside it,
   so a `%XX` triplet grows to `%25XX` and a `+` to `%2B`; a request of
   maximum-length but ordinary values (a 512-character https redirect, a
   512-byte base64url state, a 256-character scope) gives a canonical path of
   about 1.6 KB and a deepest nesting of about 2.1 KB, while adversarial
   characters can triple that. So the validator measures the request's own
   nesting instead of relying on per-field limits: the canonical consent path
   must be at most 6 KB (`consentPathMaxLength`), and its worst-case nesting
   (the login href, inside the auth callback's `next`, inside Supabase's
   `redirect_to`; the sign-up `emailRedirectTo` inside Supabase's email link
   is measured too) plus 512 characters for Supabase's own URL must be at
   most 8 KB (`nestedRedirectMaxLength`). Otherwise the request is a redirect
   error, `invalid_request` with "request too large". A test builds the
   login href, the Google chain and `emailRedirectTo` from maximum-length
   inputs and asserts each is under 8 KB.
   Because the values are encoded, `isValidInternalPath` never sees `://`.
5. The route handler's redirects to the client use `NextResponse.redirect`
   (a 302 with an absolute `Location`). That works for https, loopback and
   private-use schemes, and avoids any uncertainty about redirecting from a
   server component.

### Consent screen: `GET /oauth/consent` (`app/oauth/consent/page.tsx`)

A server component with `dynamic = "force-dynamic"`. It awaits `searchParams`,
which is a Promise in Next 15, and then:

1. Checks both flags.
2. Runs the same validation module, sending fatal results to `/oauth/error`.
3. Redirects signed-out users to login, as above.
4. For signed-in users, calls `needsOnboardingBeforeConsent(userId)`
   (`lib/utils/user-onboarding.ts`), a strict form of `isNewUser`. It returns
   true only when the profile row exists, `onboarding_completed` isn't true,
   the account is under 5 minutes old, and there's no paid plan and no
   application; a missing row or any failed query means false (unlike
   `isNewUser`, which treats a missing row as new). If so, the page redirects
   to `/onboarding/welcome?next=<encodeURIComponent(this consent URL +
   "&onboarded=1")>`, and onboarding sends the user back there when it
   finishes. The `onboarded=1` marker is a one-shot: a consent request that
   carries it (exactly one value, `1`) skips the check, so the user can't be
   bounced to onboarding a second time even if the account still looks new.
   The validator ignores the marker and the canonical query never carries
   it, so it can't reach the POST or a later login redirect.

This one check covers every sign-up route (email with confirmation, email
without, Google), so the callback and the sign-in and sign-up forms don't need
their own onboarding logic. Resuming later is safe because the consent URL
carries the whole authorization request, and nothing is stored until Approve.

The page writes nothing.

Framing is blocked for `/oauth/:path*` through `next.config.mjs` `headers()`,
merged with the existing `agentDiscoveryHeaders()`:
`Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`.

It renders:
- An `h1`: the app name, isolated in `<bdi>` so a right-to-left name can't
  reorder the sentence, then "wants to connect to your CareerOtter account".
  Below it, "CareerOtter hasn't verified this app. Only continue if you just
  started connecting it."
- **Where it will send you back**, prominently:
  - https URIs show the full hostname in bold, for example "claude.ai".
  - Loopback URIs show "an app on this computer (localhost:PORT)", or
    "(localhost)" when the URI has no port.
  - Private-use schemes show "the <scheme> app".
- `client_uri` as a link, if it's set, both it and the redirect are https,
  and they're on the same host (compared case-insensitively, ignoring a
  trailing dot; no public-suffix lookup, so a sibling subdomain doesn't
  count). Otherwise it's omitted, since it would be a phishing aid.
- The signed-in email and a "Not you? Sign out" link-style button (at least
  44px tall), which signs out and opens login with this consent URL as
  `redirectTo`. The signed-in user's id is also rendered into the form and
  posted as `expectedUserId` (see the decision below).
- The scope picker and expiry select, extracted from
  `agent-token-create-form.tsx` into a shared component. The defaults are
  always the PAT defaults (`wins:read`, `wins:write`), whatever the client
  requested. Requested scopes that aren't checked are marked "Requested by the
  app" beside the checkbox. Write implies read. "Never" is disabled while a comp
  scope is checked.
- If the user already has an active grant for this app: "Approving replaces
  this app's current access."
- If the user is at the 10-app cap and this app has no active grant: a message
  and a link to `/dashboard/data`, with no Approve button and no picker.
  Deny stays, so the app hears `access_denied` rather than waiting.
- Approve and Deny buttons, each at least 44px tall. No emojis and no pills.
- An always-mounted `aria-live="assertive"` error region above the buttons.
  When a decision fails, the message appears there and focus moves to it.
- "Don't have an account? Create one, then reconnect from your app."

**Sign-in path.** These fixes are listed in PR #226's trade-offs.
- **Every redirect target is resolved, not just string-checked.**
  `isValidInternalPath` refuses control characters (U+0000 to U+001F, U+007F)
  and any whitespace, since the URL parser strips tab, LF and CR (so
  `/\t/evil.com`, or `/%09/evil.com` once decoded, would otherwise parse as
  `//evil.com`). `validInternalPath` (`lib/utils/auth-redirect.ts`) resolves
  the value with `resolveInternalUrl` against the page's origin in the
  browser and `SITE_URL` on the server, and returns the parsed pathname,
  search and hash, which is what the login page, the sign-in and sign-up
  forms, the sign-up page, onboarding and `signUpWithPassword` navigate to.
- `app/(marketing)/login/page.tsx` awaits `searchParams`, validates
  `redirectTo` with `validInternalPath`, and passes it to
  `GoogleSignInButton`. The button already encodes it into the callback's
  `next`.
- `components/forms/sign-in-form.tsx`: a valid `redirectTo` wins over the
  onboarding redirect (the new-user check isn't made at all then; the
  consent page runs its own).
- `middleware.ts`: the rule that sends a signed-in user on `/login` or
  `/signup` to `/dashboard` sends them to a valid `redirectTo` instead,
  checked with `resolveInternalUrl`.
- Sign-up carries the destination too:
  - `app/(marketing)/signup/signup-page-client.tsx` reads and validates
    `redirectTo` and passes it to its `GoogleSignInButton`, which already takes
    a `redirectTo` prop. It wins over the preview and offer destinations.
  - It also passes `redirectTo` to `SignUpForm`, and `signUpWithPassword` gains
    an optional `redirectTo`, validated server-side with
    `validInternalPath`. The confirmation email then links to
    `/auth/callback?next=<encoded redirectTo>` instead of `/auth/callback`.
  - When no confirmation is required, the form goes to `redirectTo`, ahead of
    its onboarding, promo and preview branches.
  - The login page's "Sign up" link and the signup page's "Sign in" link carry
    `redirectTo` across.
- Onboarding honors `next`: `app/(app)/onboarding/welcome/page.tsx` reads
  `next` and validates it with `validInternalPath`. Its non-checkout exits go
  there instead: finishing on the free plan (instead of the first-job step),
  and the "already on a paid plan" redirect (instead of `/dashboard`). Paid-plan checkout still goes through Stripe and
  returns to the dashboard; that's a non-goal.
- Launch checklist: confirm that Supabase's redirect allow-list already accepts
  `https://careerotter.io/auth/callback?next=…`. Google sign-in with `next`
  already works for the comp page's `redirectTo`, so this is a check, not a
  change.

### Consent decision: `POST /api/oauth/authorize`

- It checks both flags and accepts only a session cookie (via
  `getSessionUserId`). It requires `Content-Type: application/json` and an
  `Origin` equal to the request origin; otherwise it returns 403.
- **Body:** `{ params, decision, expectedUserId, scopes?, expiresInDays? }`,
  where `params` is the canonical query as an object of strings and
  `expectedUserId` is the user the consent screen was rendered for. When the
  session is now someone else (for example, after signing in as another
  account in a second tab), the answer is 409
  `{ error: "account_changed", message: "You're signed in as a different
  account. Reload to continue." }`, checked before anything is validated or
  stored. A missing or non-string `expectedUserId` is a malformed body. The server re-runs the full
  validation: fatal → 400, a lookup failure → 503, a redirect error →
  `{ redirectUrl }` of that error. No session → 401; the consent form then
  navigates to login with this consent path as `redirectTo`, rather than
  leaving the user on a dead screen. A malformed body → 400;
  over the 16 KB cap → 413. Every answer is `no-store`.
- **Approve:**
  1. Normalize the scopes with the PAT rules (`validateAccessChoice` in
     `lib/auth/agent-token.ts`, shared with token creation): known scopes,
     write implies read; `expiresInDays` one of 30, 90, 365 or null (never),
     defaulting to 90 when omitted. Comp scopes without an expiry → 400.
  2. Call `create_agent_oauth_code` with a `co_code_` code's digest and the
     lifetime as an interval string (`'90 days'`, or null). At the cap → 409;
     `invalid_client` (deleted since validation) → 400; an RPC failure → 503.
  3. Respond with `{ redirectUrl }`: the stored redirect URI plus `code`,
     `state` and `iss`, appended with `URLSearchParams` so any existing query
     is kept. No fragment is ever added.
- **Deny:** `{ redirectUrl }` with `error=access_denied`, `state` and `iss`.
- The browser is sent to the redirect URI as presented, which is the exact
  registered string or a loopback match differing only in port (the port the
  client is listening on). The code stores the registered string, which the
  token endpoint matches with loopback matching.
- Double submit: the form sets an in-flight ref synchronously on the first
  click, before React disables the buttons, so two rapid clicks send one
  request. Should two approvals still arrive (two tabs), each creates a new
  code; only the one the browser follows is used, and the others expire.

### Token endpoint: `POST /api/oauth/token`

- **Request basics:** `application/x-www-form-urlencoded`, with a 16 KB cap.
  CORS as for registration. POST and OPTIONS only. Every response carries
  `Cache-Control: no-store` and `Pragma: no-cache`.
- **Client authentication:**
  - `none`: `client_id` in the body.
  - `client_secret_basic`: the `Authorization: Basic` header. Credentials are
    form-URL-decoded after base64 decoding (RFC 6749 §2.3.1).
  - `client_secret_post`: `client_id` and `client_secret` in the body.
  - An empty `client_secret` in the body, or an empty password in the Basic
    header, counts as no secret: the request is authenticating as `none`
    (with the Basic header carrying only the `client_id`).
  - A header with the `Basic` scheme (any case) whose credentials are
    malformed is an `invalid_client` failure with `WWW-Authenticate: Basic`,
    never ignored.
  - The method used must match the registered one.
  - Secrets are compared as SHA-256 digests with `timingSafeEqual`. Digests
    have a fixed length, so the call never throws.
  - Failure → 401 `invalid_client`, plus `WWW-Authenticate: Basic` when Basic
    was used.
- **`grant_type=authorization_code`:**
  - `code`, `code_verifier` (43–128 characters from the RFC 7636 charset) and
    `redirect_uri` are required.
  - Steps:
    1. Authenticate the client.
    2. Load the code by hash. It must be for this client, with the same
       `redirect_uri` (loopback matching applies).
    3. Verify PKCE: `base64url(sha256(verifier))` compared timing-safely with
       the stored challenge.
    4. If `resource` is present, it must normalize to the code's resource.
    5. Call `exchange_agent_oauth_code`, which handles expiry, reuse and the
       cap atomically.
  - A mismatch before step 5 is `invalid_grant` (a `resource` mismatch is
    `invalid_target`, RFC 8707) and has no side effects.
  - The RPC's `grant_cap` result → `invalid_grant` with the description
    "Too many connected apps. Remove one on your CareerOtter data page."
  - `p_issue_refresh` is set only when the client registered the
    `refresh_token` grant.
- **`grant_type=refresh_token`:**
  - `refresh_token` is required.
  - If `resource` is present, it must normalize to the grant's resource. An
    empty `resource=` counts as present and fails (`invalid_target`), at both
    grants.
  - If `scope` is present, it must be a subset of the grant's scopes after
    ignoring unknown values; otherwise `invalid_scope`. The same scopes are
    issued either way (no downscoping).
  - The client must have registered the `refresh_token` grant.
  - Then `rotate_agent_oauth_refresh` runs.
- Any other grant type → `unsupported_grant_type`.
- **Success response:**
  `{ access_token, token_type: "Bearer", expires_in, refresh_token?, scope }`.
  `expires_in` is the real remaining lifetime from the RPC (at most 86400), and
  `scope` is space-separated.
- **Rate limits:**
  - 60 requests per minute per client, charged only after client
    authentication succeeds. A confidential client proved its secret, so its
    bucket is keyed on its `client_id`. A public client (`none`) proves only
    that it knows a public `client_id`, so its bucket is keyed on the
    `client_id` and the caller's IP (an IPv6 caller by its /64): anyone else
    sending that id can exhaust only their own IP's slice, never the real
    client's.
  - 600 failed client authentications per minute per IP (IPv6 by /64).

  A failed authentication is charged only to the per-IP bucket, never to the
  `client_id` it named, so a caller can't drain another client's quota by
  sending its id with a bad secret. Before the client lookup, the per-IP
  bucket is checked without charging (Upstash `getRemaining`): an IP that has
  already spent it gets 429 without any database query. Successful requests
  don't count toward the per-IP limit, because hosted clients share IPs, but
  an IP over it is refused even for a client that would have authenticated;
  bounding database work for a failing IP is worth that. Over a limit → 429
  with `Retry-After` and
  `{ error: "invalid_request", error_description: "rate limited" }`. Every
  check fails closed: Redis missing, erroring or slower than 2 s → 503.

### Revocation: `POST /api/oauth/revoke`

- Form-encoded, with the same client authentication as the token endpoint.
- `token` is required. `token_type_hint` is ignored.
- If the token belongs to this client, its whole grant is revoked.
- Always returns 200 with an empty body, including for unknown tokens
  (RFC 7009).
- CORS headers as for registration.
- Rate limits: the token endpoint's two buckets, shared with it (per client
  after authentication succeeds, split per caller IP for a public client;
  failed authentication per IP, checked before the client lookup).
- A token that isn't an OAuth token of ours, or whose checksum doesn't match,
  revokes nothing and is answered 200 without a database call.

### Metadata

- `/.well-known/oauth-protected-resource/api/mcp` and the root
  `/.well-known/oauth-protected-resource` serve the same body:
  `{ resource: "<origin>/api/mcp", authorization_servers: [issuer], scopes_supported: [five scopes], bearer_methods_supported: ["header"], resource_name: "CareerOtter" }`.
- `/.well-known/oauth-authorization-server` serves:
  - `issuer`, `authorization_endpoint`, `token_endpoint`,
    `registration_endpoint`, `revocation_endpoint`
  - `response_types_supported: ["code"]`
  - `grant_types_supported: ["authorization_code","refresh_token"]`
  - `code_challenge_methods_supported: ["S256"]`
  - `token_endpoint_auth_methods_supported` and
    `revocation_endpoint_auth_methods_supported`: both
    `["none","client_secret_basic","client_secret_post"]`
  - `scopes_supported`
  - `authorization_response_iss_parameter_supported: true`

  Tests validate it against `OAuthMetadataSchema`.
- **Issuer and origins.** The issuer is always `SITE_URL`. The authorization
  server metadata is identical on every accepted host, and every endpoint URL
  in it is absolute on `SITE_URL`.
- **Resource URL.** `resource` is `<origin>/api/mcp`. `<origin>` is the
  request origin when it's in the accepted set (`SITE_URL` plus
  `CAREEROTTER_MCP_EXTRA_ORIGINS`), and `SITE_URL` otherwise. The same set
  decides the origin in `WWW-Authenticate` and which `resource` values are
  accepted, so a spoofed Host header can't change what we advertise.
- **Headers.** GET and OPTIONS. CORS `*`, with
  `Allow-Headers: MCP-Protocol-Version, Authorization, Content-Type`. The
  protected resource documents also send `Vary: Host, X-Forwarded-Host`,
  because `resource` follows the request origin.
  `Cache-Control: public, max-age=60`. Flag-checked in each handler.
- **Previews.** OAuth is off on Vercel preview deployments
  (`VERCEL_ENV === "preview"`) whatever the flag says. On a preview, the
  issuer would be the production origin (a mismatch under RFC 8414 §3.3), and
  previews may share the production database, so tokens would also work
  against unreviewed code.

### MCP route changes (`app/api/mcp/route.ts`)

- **Dispatch on the token prefix:**
  - `co_pat_` → the existing PAT path, unchanged
  - `co_oat_` → the OAuth path, when OAuth is enabled
  - anything else → today's format failure
- **OAuth path:** checksum pre-check, then hash lookup (under the existing
  abortable deadline), then the per-grant rate limit
  (`agentRate:oauth:<grantId>`, the same numbers as per-token).
  - The context gets `credentialKind: "oauth"`.
  - `touchGrantLastUsed` updates `agent_oauth_grants`, throttled to once every
    5 minutes.
- **Failure accounting.** With OAuth enabled:
  - A request with no `Authorization` header is the discovery probe. It gets
    the 401 challenge and isn't counted.
  - `co_oat_` failures of every kind (bad checksum, not found, expired,
    revoked) don't count toward the existing 30/min per-IP auth-fail lockout.
    Claude.ai users share egress IPs, and a returning user's stale token is
    normal.
  - Instead, they count toward a separate `oauthFailPerIp` limiter set at
    600/min. It exists to bound database lookups, not to stop guessing: a
    token has 256 bits of entropy.
  - Malformed bearers and `co_pat_` failures behave exactly as today.
  - With OAuth disabled, everything behaves exactly as today, including
    counting a missing header.
- **401s with OAuth enabled** carry
  `WWW-Authenticate: Bearer resource_metadata="…", scope="wins:read wins:write"`.
  When a token was presented, they also carry
  `error="invalid_token", error_description="…"`. With OAuth disabled, 401s
  are byte-identical to today.
- **`McpToolContext`** gains `credentialKind: "pat" | "oauth"`. `tokenId` keeps
  its name and is documented as the credential id: a PAT id or a grant id.
  - Touch and rate-limit code branch on `credentialKind`, so a grant id never
    reaches `touchLastUsed`. A test covers this.
  - Analytics metadata gains `credentialKind`.
- **No step-up.** Tools are registered per scope, so an out-of-scope tool
  doesn't exist for the client, and there's no 403 `insufficient_scope` path.
  The server instructions tell the agent to have the user reconnect with more
  scopes when it needs them. Step-up is a follow-up.

### Connected apps UI and API

- `GET /api/careerotter/agent-grants` (session cookie only):
  - Returns active grants plus grants revoked or expired in the last 30 days.
  - Each grant has
    `{ id, clientName, redirectDisplay, scopes, createdAt, lastUsedAt, expiresAt, status }`.
  - When OAuth is disabled it returns `{ enabled: false, grants: [] }`.
- `DELETE /api/careerotter/agent-grants/[id]` takes a uuid and calls
  `revoke_agent_oauth_grant`. A missing or foreign id → 404.
- **Revoke-all** (the existing route) also calls
  `revoke_all_agent_oauth_grants`, whether or not OAuth is enabled. If the
  function doesn't exist yet (045 hasn't run; Postgres `42883`), it counts as
  zero grants.
  - The two calls aren't atomic. If the grants call fails after the tokens
    were revoked, the route returns 500 `{ tokensRevoked, grantsRevoked: null }`.
    Both calls are idempotent, so retrying is safe.
  - Because revoke-all always covers grants, turning the flag off and back on
    can't revive a grant the user revoked.
- **UI.** A "Connected apps" list in `connected-agents.tsx` shows each app's
  name, where it sends you back, scopes, connected date, last used and expiry,
  with a Revoke button (confirm, 44px). It also has a "Sign in with your
  browser" setup option, shown first when OAuth is enabled:
  - Claude.ai: Settings > Connectors > Add custom connector, with the URL
  - Claude Code: `claude mcp add --transport http careerotter <url>`, then `/mcp`
  - Cursor: the URL-only `mcp.json` entry

  `isMcpOAuthEnabled()` reaches client components as a prop from
  `app/(app)/dashboard/data/page.tsx`.

### Gating

`isMcpOAuthEnabled()` is true only when all of these hold:
- `CAREEROTTER_ENABLED=1`
- `CAREEROTTER_MCP_OAUTH_ENABLED=1`
- `VERCEL_ENV !== "preview"`

Every new surface returns 404 when it's false. The check is in each handler and
page, and also in middleware where the matcher reaches:
- the three `.well-known` documents
- `/oauth/authorize`, `/oauth/consent`, `/oauth/error`
- `/api/oauth/*`
- the `co_oat_` branch of `/api/mcp`
- `/api/careerotter/agent-grants*` (GET is flag-gated; revoke-all isn't)

The cleanup cron (`/api/cron/agent-oauth-cleanup`) is gated on
`CAREEROTTER_ENABLED` only, so rows keep getting cleaned up while the OAuth flag
is off. It treats a missing function as a no-op: Postgres `42883`, or
PostgREST's `PGRST202`, which is what an RPC to a function that doesn't exist
actually returns.

Middleware changes:
- `isCareerotterSurface` gains the new page and cron paths.
- The matcher gains `/api/oauth/:path*` and `/api/cron/agent-oauth-cleanup`.
- The early return that `/api/mcp` already takes (no Supabase session refresh,
  no legacy-host redirect, no markdown negotiation) extends to
  `/.well-known/oauth-*` and `/api/oauth/*`.
- The `/oauth/*` pages keep the session refresh.

### Observability

Analytics events are sent after the response and never contain token material:
- `mcp_oauth_client_registered`: auth method and redirect kinds. There's no
  user yet, so the distinct id is the `client_id`, sent with
  `$process_person_profile: false`.
- `mcp_oauth_connected`: scopes and client name, sent at the first successful
  code exchange
- `mcp_oauth_revoked`: reason

Security logs go through `loggerService` with `LogCategory.SECURITY`:
- token-endpoint failures, by reason
- registration rejections and rate-limit hits
- code-reuse and refresh-reuse detections (grant id only)
- idle revocations

### Environment

- `CAREEROTTER_MCP_OAUTH_ENABLED=1`, server-only, read through
  `isMcpOAuthEnabled()` in `lib/constants/agent-oauth.ts`.
- `CAREEROTTER_MCP_EXTRA_ORIGINS` (optional, comma-separated): extra accepted
  origins, such as `https://www.careerotter.io` if that host serves the app.
- The cron uses the existing `verifyCronAuth` (`lib/email/lifecycle-cron.ts`)
  and gets a daily entry in `vercel.json`.

## Edge Cases & Risks

- **Phishing with lookalike app names.** Anyone can register an app called
  "Claude". Mitigations:
  - the unverified notice
  - the return destination shown prominently
  - `client_uri` shown only on the redirect's host
  - a phished grant exposes only the approved MCP scopes, never the account
- **Redirect-URI attacks.** Redirect URIs must match the registered string
  exactly (loopback URIs may differ only in port). Registration allowlists the
  schemes and bans our own hosts. Errors about the client id or redirect URI
  are never redirected.
- **Intercepted authorization codes.** PKCE S256 is required. Codes are single
  use and expire after 5 minutes. A reused code revokes the grant it produced,
  but only after the client has authenticated and PKCE has passed, so an
  interceptor can't revoke a victim's connection.
- **Stolen refresh tokens.** Tokens rotate, and reuse is detected for the whole
  token lifetime. A 60-second grace window, capped at 5 extra pairs, covers
  parallel refreshes by one client, so multi-worker hosted clients and shared
  keychains don't force the user to re-approve. Each grace reissue supersedes
  the successors issued before it (and deletes their access tokens), so a
  consumed token has at most one live successor chain: an attacker racing the
  client can't keep a chain alive alongside it, and whichever side presents a
  superseded token revokes the grant. Presenting a consumed token after the
  window, after one of its successors has been used, or past the 5-pair limit
  also revokes the grant.
- **Mix-up attacks.** The `iss` parameter is included on every authorization
  response (RFC 9207) and advertised in the metadata.
- **Consent CSRF.** Requires the session cookie, a same-origin `Origin` and a
  JSON content type. The authorize handler and the consent page write nothing.
- **Clickjacking.** `frame-ancestors 'none'` and `X-Frame-Options: DENY` on
  `/oauth/*`.
- **Registration abuse.**
  - Limits: 30 per IP per 10 minutes, 100 per IP per day and 2,000 per day
    globally, failing closed when Redis is unavailable. Only valid
    registrations spend the global quota.
  - Size: rows are capped at about 3 KB.
  - Cleanup: clients that never authorize are purged after 24 hours.
  - Per-IP limits key IPv6 clients on their /64, so rotating addresses
    within one allocation doesn't help; rotating across many /64s still
    runs into the global cap.
- **Shared egress IPs (Claude.ai).** The per-IP limits cover only failures or
  registrations, and are sized for a shared backend. At the token endpoint an
  IP over 600 failed authentications a minute is refused for every client
  until the window moves on, so a noisy neighbour on a shared egress IP can
  block others for up to a minute; public clients' per-client buckets are
  split per IP, so they can't be drained from elsewhere. The MCP route's OAuth
  failures have their own 600/min limiter and never trip the PAT lockout.
- **Database load.** One indexed primary-key lookup per MCP request, the same
  as for PATs. See "Row counts" for token churn.
- **Clocks.** Every expiry is computed in Postgres with `now()`.
- **Concurrent refreshes, and the client keeps the older successor.** Two
  refreshes of one token race: the first rotates it (successor A), the second
  is a grace reissue (successor B) that supersedes A. If the client ends up
  storing A (say, A's response arrived last), its next refresh, however much
  later, presents a superseded token, which is reuse: the grant is revoked and
  the user has to reconnect. This is deliberate: the server can't tell a
  client that lost its own race from an attacker replaying a stolen token,
  and letting A live would let an attacker keep a chain alongside the client.
  Clients should serialize refreshes or keep the newest response. Covered by
  the verifier (G4, G8) and the token route suite.
- **Stuck locks.** The functions that wait for locks give up after 3 seconds
  (`lock_timeout`) and the endpoint answers 503; the side-effect-free lookups
  are aborted after 5 seconds. A request never hangs until the platform kills
  it, and a timed-out exchange or rotation consumed nothing.
- **Concurrent exchanges of the same code.** Serialized by the row lock.
  Exactly one succeeds. The second is a reuse (it passed client
  authentication and PKCE, so it's the same client) and revokes the new grant.
  This is rare, and it's what the spec requires.
- **User deleted.** Grants, codes and tokens cascade from `profiles`.
- **Flag turned off while grants are live.** `co_oat_` tokens get today's 401
  format, and grants stay. Revoke-all still revokes grants. Turning the flag
  back on restores only grants that weren't revoked. The metadata's 60-second
  cache means discovery can outlive the kill switch by up to a minute; the
  endpoints themselves stop at once.
- **Grants for re-registered clients.** A client that registers again gets a new
  `client_id` and so a second grant. The old grant stops being used and is
  revoked with reason `idle` after 30 days, or earlier by the user.
- **Sign-up mid-flow.** Email and Google sign-up carry the request through
  confirmation and onboarding back to consent. Two cases still need the user
  to reconnect:
  - They choose a paid plan during onboarding.
  - The app stopped waiting. The app holds its own pending request, and it may
    give up if email confirmation takes a long time. They click Connect again,
    already signed up, and it's quick.
- **Spec drift.** MCP authorization 2025-11-25 prefers Client ID Metadata
  Documents; v1 supports only dynamic registration. Whether each target
  client uses DCR (Claude.ai, Claude Code, Cursor, Claude Desktop, MCP
  Inspector) is unverified, and it's the first real-client test at launch. A
  client that requires CIMD becomes a follow-up.
- **The Supabase OAuth server is on right now.** Any signed-in user can use
  Supabase's consent API to mint full-power Supabase tokens for their own
  account. The user was asked to turn it and dynamic registration off right
  away. The launch checklist repeats it as step 0.

## Open Questions

1. Does `www.careerotter.io` serve the app or redirect? That decides
   `CAREEROTTER_MCP_EXTRA_ORIGINS`. Default: `SITE_URL` only.
2. Client ID Metadata Documents: add them when a target client requires them.
   Default: follow-up.
3. Step-up authorization (`insufficient_scope`): follow-up.

## Revision Notes

The first two reviews were of the earlier Supabase-OAuth design. Their findings
that still apply are folded in. The rest no longer apply because Supabase
tokens aren't used: the cookie and refresh bypass, the pre-request hook, the
Storage policy, JWKS and the key switch, `client_id` claim verification, and the
GoTrue endpoint checks.

The Supabase design was rejected after reading Supabase Auth's source; see "Why
not Supabase Auth's OAuth server".

Critic review of this design, and how each point was resolved:

**Blockers**
- Shared egress IPs lock out Claude.ai → `co_oat_` failures no longer count
  toward the PAT lockout; they have a separate 600/min limiter. Registration is
  30 per IP per 10 minutes plus a global cap. The token endpoint's per-IP limit
  counts only failed client authentication.
- The default consent grants everything, because the SDK requests all of
  `scopes_supported` → the 401 carries a `scope` hint, and the defaults are
  always the PAT defaults, with requested scopes labelled.
- No `grant_types` column → added. Refresh tokens are issued only to clients
  that registered the refresh grant.
- The cap races between code creation and exchange → re-checked in
  `exchange_agent_oauth_code` under the per-user lock.

**Token lifecycle**
- Concurrent refreshes revoke the grant → a 60-second grace window, capped at 5
  extra pairs (RFC 9700 §4.14.2).
- Reuse detection only lasted a day → consumed refresh tokens are kept until
  their own expiry (at most 30 days).
- Code-reuse ordering and who can trigger it → PKCE and client authentication
  run before the RPC. Reuse revokes only after both pass. The RPC reads the
  user first, then locks.
- `expires_in` overstated → the real remaining lifetime from the RPC.

**Compatibility with RFCs and clients**
- Loopback ports → the port is ignored for loopback URIs (RFC 8252 §7.3).
- Unknown scopes failed the flow → they're ignored.
- `resource` matching → normalized. When absent, the canonical `SITE_URL`
  resource is stored. It's stored on the grant and validated on refresh.
- CORS preflight → `Allow-Headers` specified. Browser-direct MCP isn't
  supported, and that's stated.
- Issuer and preview deployments → the issuer is `SITE_URL`
  (`NEXT_PUBLIC_APP_URL`), and OAuth is disabled on previews.
- Root metadata fallback → added.

**Sign-in and consent**
- User review of the sign-up trade-off → sign-up now carries `redirectTo` (email
  confirmation through `next`, and Google), and the consent page sends new
  accounts through onboarding with `next`. An earlier note said onboarding
  would only be delayed until the next dashboard visit. That was wrong:
  `isNewUser()` only fires in the first 5 minutes, so onboarding would have
  been skipped for good.
- User review of the 720-row estimate → access tokens now last 24 hours, which
  is safe because revocation is checked on every request. That brings consumed
  refresh rows to about 30 per grant.
- The `redirectTo` round trip → the query is canonicalized with
  `URLSearchParams`, and the size budget is stated.
- Google sign-up bypasses onboarding → accepted and documented.
- Redirecting from a server component → authorize is now a route handler, and
  consent is a separate page.
- Phishing display → the full hostname in bold, and `client_uri` only on the
  same host.

**Data model and abuse**
- Stale grants fill the cap → idle revocation after 30 days.
- Kill switch versus revoke-all → revoke-all always covers grants, the
  partial-failure response is specified, and a missing function is tolerated.
- Registration abuse → the global cap, fail-closed behavior and row size
  limits.
- The Supabase OAuth server is on now → the user was told to turn it off
  immediately.

**Minor fixes**
- `client_deleted` removed. Grants now restrict client deletion and keep a
  snapshot of the client name.
- `last_used_at` versus "the page writes nothing" → replaced by
  `first_authorized_at`, which the exchange sets.
- Clock skew → expiries are computed in the database.
- Row-count estimate corrected.
- `slow_down` replaced by 429 with `Retry-After`.
- Basic auth: `WWW-Authenticate` on failure, and form-decoded credentials.
- `timingSafeEqual` is used on fixed-length digests.
- Refresh validates `resource`, and grants store it.
- Names are truncated by code points.
- The scheme denylist is extended and our own hosts are banned.
- The cleanup cron is gated separately.
- The metadata cache is 60 seconds.
- A grant-id touch guard is added.
- Next 15's `searchParams` is a Promise, which is now noted.
- DCR support is an explicit launch test.
- Step-up is a follow-up.
- The callback allow-list is a check, not a change.

**Review of Task 1 (CodeRabbit and a bugs review)**
- CodeRabbit: a consumed refresh token replayed inside the grace window minted
  an independent pair, so an attacker racing the client kept a live chain →
  tokens record `pair_id` and `rotated_from_hash`; a grace reissue supersedes
  the earlier successors and deletes their access tokens; a superseded token,
  or a consumed one whose successor was used, is reuse.
- CodeRabbit: the token endpoint's per-client bucket could be drained with
  another client's id → it's charged only after client authentication
  succeeds; failures go to the per-IP bucket only.
- The exchange and cleanup could deadlock (code row, then client row, against
  the reverse) → the exchange locks the client row first, and cleanup deletes
  clients before codes.
- Idle revocation could revoke a grant used after the scan → set-based, `for
  update skip locked`, with the idle test re-checked under the lock.
- Code creation raced a client delete into an FK error → it locks the client
  row `for key share`.
- A grant with seconds left produced `expires_in` 0 and a dead refresh token →
  exchange and rotation refuse a grant with under a minute left.
- `grant_expires_in` was unbounded → at most 365 days, which also rejects
  infinity.
- Rotation accepted null new hashes → it raises, like the exchange.
- A used code replayed after expiry didn't revoke → reuse is checked before
  expiry.
- Empty redirect URIs passed the CHECK → rejected.
- `revoke_agent_oauth_grant` returned a bare value → a record with `grant_id`,
  like the other functions.
- A `*` in `CAREEROTTER_MCP_EXTRA_ORIGINS` was accepted and never matched →
  rejected at parse time.

**Task 3 implementation notes**
- The canonical query also carries `response_type` and
  `code_challenge_method`, so one validator serves all three callers.
- A failed client or grant lookup shows an "unavailable" card on
  `/oauth/error` rather than the invalid-link one.
- `client_uri` is compared by exact host, since there's no public-suffix list
  in the repo.
- At the cap, Deny remains so the app gets `access_denied`.
- Full-page navigations from the consent screen go through
  `lib/utils/browser-navigation.ts`, a seam tests can replace.

**Review of Task 3**
- Open redirect: `/\t/evil.com` (and `\n`, `\r`, or `%09`/`%0a`/`%0d` once
  decoded) passed `isValidInternalPath` and parsed off-origin →
  control characters and whitespace are refused, and every client and server
  redirect of a user-supplied path navigates to the parsed path from
  `resolveInternalUrl` (`validInternalPath`, `safeInternalPath`).
- Onboarding loop: `isNewUser` is true when the profile query fails or
  returns no row → the consent page uses the strict
  `needsOnboardingBeforeConsent`, and the consent URL onboarding returns to
  carries a one-shot `onboarded=1` marker the page honors and the validator
  ignores.
- Account switch mid-consent → `expectedUserId` in the POST; 409
  `account_changed` asks the user to reload.
- Session expiry mid-consent stranded the user → a 401 navigates to login
  returning to the consent path.
- URL length → state is limited in UTF-8 bytes, and the canonical path and
  its worst-case nesting are capped at 6 KB and 8 KB ("request too large").
- Double submit → an in-flight ref set synchronously.
- A right-to-left client name could reorder the heading → `<bdi>`.
- Accessibility → the heading is an `h1`, errors go to an always-mounted
  assertive region that takes focus, and the sign-out link-button is 44px.
- CodeRabbit: a consumed refresh token that had expired could still get a
  grace reissue → `invalid_grant`, checked after reuse detection so
  superseded-token reuse still revokes.

**Task 4 implementation notes**
- A `resource` that doesn't match the code's (or, on refresh, the grant's) is
  `invalid_target` rather than `invalid_grant`, as RFC 8707 §2 specifies. It
  is still checked before the RPC, with no side effects.
- A repeated parameter (RFC 6749 §3.2) is `invalid_request`, and a repeated
  `resource` is `invalid_target`; both are answered before client
  authentication.
- A missing `code_verifier` is `invalid_request`; one outside the RFC 7636
  charset or length is `invalid_grant`, like a wrong one. The stored and
  computed challenges are compared as SHA-256 digests of the strings, so the
  comparison is fixed-length and exact.
- Refresh looks the presented token up, joined to its grant, before rotating:
  an unknown token, an access token or another client's token is
  `invalid_grant` without calling `rotate_agent_oauth_refresh`, and `resource`
  and `scope` are checked against that grant.
- A failed client authentication over the per-IP limit gets 429 instead of
  401. (Changed in the review below: the bucket is now also checked, without
  charging, before the client lookup.)
- A client lookup failure is 503 `temporarily_unavailable`, as is Redis being
  unavailable for either bucket.
- `mcp_oauth_revoked` from the revocation endpoint uses the `client_id` as the
  distinct id with `$process_person_profile: false`, since
  `revoke_agent_oauth_token` returns no user.
- The Basic challenge is `WWW-Authenticate: Basic realm="CareerOtter"`.
- The cleanup cron answers 404 (before cron auth) when `CAREEROTTER_ENABLED`
  is off, like the middleware gate, and runs daily at 03:30 UTC.
- The fail-closed rate-limit check and the 429/503 bodies moved to
  `lib/auth/oauth/rate-limit.ts`, shared by registration, token and
  revocation.

**Review of Task 4**
- Public-client quota drain: a `none` client authenticates with just its
  public `client_id`, so anyone could spend its 60/min bucket → a public
  client's bucket is keyed on the `client_id` plus the caller's IP key;
  confidential clients keep the plain `client_id` key.
- The failed-auth bucket didn't protect the database: every request still ran
  the client lookup → the bucket is checked without charging before the
  lookup (429 when spent, 503 when Redis fails), and still charged on
  failure. An IP over it is now refused even for good clients; that trade-off
  replaces the Task 4 note above.
- Unbounded waits → the lookups are aborted after 5 s
  (`AGENT_OAUTH_DEADLINES_MS.dbRead`); the lock-taking functions set
  `lock_timeout = '3s'` in 045 instead of being aborted by the caller; either
  failure is 503.
- Cleanup could delete a client whose user had just approved it (cascading
  to the code) → a client with an unexpired code is kept. The deletes are
  batched (5,000 per rule per call, up to 10 calls per run), and a failed run
  logs at error level.
- A client that keeps the older successor of a refresh race revokes its grant
  on the next refresh → documented under Edge cases, with verifier and route
  tests.
- An empty `client_id=` alongside Basic counted as a second method → read as
  absent. An empty `resource=` at the token endpoint was read as absent →
  `invalid_target`.
- The route tests' fake database ignored the select list → it returns only
  the selected columns (embedded ones included), throws on an unknown column,
  records every query, and drops expired access tokens on rotation like the
  SQL. Tokens with a wrong checksum are refused without touching codes,
  tokens or functions.
- Conventions: one `formParam`; `AGENT_OAUTH_GRANT_TYPE`,
  `AGENT_OAUTH_TOKEN_KIND` and `AGENT_OAUTH_SCOPE_SEPARATOR` constants;
  `isExpiredAt` in `lib/utils/date.ts`; `digestsEqual` in
  `lib/auth/prefixed-secret.ts` for PKCE and client secrets; `HTTP_STATUS`
  everywhere in the OAuth code; the cross-module types in `types/index.ts`;
  shared test fixtures in `__tests__/utils/test-helpers/oauth-fake-db.ts`.

**Not adopted**
- "Recognized" labels for known clients: a static list would go stale and could
  mislead. The hostname display does the job.
- A global cap on active grants: the per-user cap plus idle revocation bounds
  it.
