# Task Breakdown: OAuth 2.1 sign-in for the CareerOtter MCP server

PRD: `.claude/ship/mcp-oauth-PRD.md`. Extends PR #226 (`.claude/ship/mcp-TASKS.md`).

Stack: TypeScript / Next.js 15.2 App Router, Supabase, pnpm.
- Type check: `npx tsc --noEmit`. The baseline is 378 errors; the gate is no new
  errors.
- Tests: `npx jest`. Four suites already fail on main (`stripe-status-map`,
  `stripe-trial-will-end`, `stripe-webhook`, `services/ai-generation`); the gate
  is no new failures.
- Lint: `pnpm lint` can't run because ESLint isn't installed, so it's skipped as
  before. There's no formatter; match the surrounding style.
- SQL: exercise migrations on a local Postgres 16, never against the Supabase
  project.

## Task 1: Migration 045, constants and types
- [x] 1.1: Write `schemas/migrations/045_mcp_oauth.sql` (begin/commit):
  - the `agent_oauth_clients` table, including `grant_types` and
    `first_authorized_at`
  - the `agent_oauth_grants` table, including `client_name`, `resource` and
    `revoke_reason`, with the client foreign key set to `on delete restrict`
  - the `agent_oauth_tokens` and `agent_oauth_codes` tables (the codes table
    stores `grant_expires_in` as an interval)
  - CHECKs and indexes on all four tables; RLS on, with no policies
  - these functions, all security definer, with `search_path = public` and
    EXECUTE granted to `service_role` only:
    - `create_agent_oauth_code`: takes the per-user lock and checks the cap
    - `exchange_agent_oauth_code`: reads the user, takes the lock, re-checks
      the cap, handles code reuse and grant replacement, and issues refresh
      tokens only when asked
    - `rotate_agent_oauth_refresh`: locks the grant row and applies the
      60-second, 5-pair grace window (each reissue supersedes the earlier
      successors, linked by `rotated_from_hash` and `pair_id`) and reuse
      revocation
    - `revoke_agent_oauth_grant`
    - `revoke_all_agent_oauth_grants`
    - `revoke_agent_oauth_token`
    - `delete_expired_agent_oauth_rows`: covers the retention rules, deletes
      unused clients after 24 hours, and revokes grants idle for 30 days
  - all expiries are computed in the database from intervals
- [x] 1.2: Add `lib/constants/agent-oauth.ts`:
  - `isMcpOAuthEnabled()`, which requires both flags and a non-preview
    deployment
  - prefixes
  - lifetimes: access token 24 hours, code 5 minutes, refresh token 30 days
    idle, unused clients 24 hours, idle grants 30 days
  - limits: redirect URIs (5 × 512), name (100 code points), `state` (512),
    `scope` (256), body sizes
  - rate limits:
    - registration: 30 per IP per 10 minutes, 2,000 per day globally
    - token endpoint: 60 per minute per client, charged only after client
      authentication succeeds; 600 per minute per IP, counting only failed
      client authentication
    - `oauthFailPerIp`: 600 per minute
  - the scheme denylist
  - the accepted-origins helper and the accepted resource URLs
    (`getAcceptedMcpOrigins`, `getAcceptedMcpResources`,
    `CANONICAL_MCP_RESOURCE`); normalizing a presented `resource` is left to
    2.3, which checks it against `getAcceptedMcpResources()`
  - endpoint paths, CORS headers, the default-scope hint and the 10-grant cap
- [x] 1.3: Add types to `/types/index.ts`:
  - client, grant and grant-summary records
  - `AgentCredentialKind`
  - the authorize-params validation result union
  - the token-endpoint error type
- [x] 1.4: Write tests for Task 1:
  - the constants mirror the migration's CHECK lists, bounds and the cap
  - on local Postgres, with stubs for `auth.users`, `profiles` and
    `service_role` (committed as `schemas/tests/045_mcp_oauth_verify.sql`
    and `.sh`, run by hand):
    - code creation respects the cap, and allows replacing an app at the cap
    - the cap is re-checked at exchange: two codes created at 9 grants → the
      second exchange returns `grant_cap`
    - a code exchanges once; reusing it revokes the grant, even after the
      code expired; another client's code or an expired unused code gets
      `invalid_grant` with no revocation
    - the refresh token is omitted when not requested
    - rotation succeeds and links the new pair to the presented token; a
      refresh from another client gets `invalid_grant`
    - a reuse within 60 seconds issues a new pair (up to 5 times) and
      supersedes the successors issued before it, deleting their access
      tokens: racing two refreshes of one token leaves only the last
      successor working
    - presenting a superseded token revokes the grant; so does presenting a
      consumed token whose successor has been used, even inside the window;
      a reuse after the window or past 5 reissues revokes the grant and
      deletes its tokens
    - a grant with under a minute left gets `invalid_grant` at exchange and
      rotation; rotation with a null new hash raises
    - CHECKs reject `grant_expires_in` of 0, over 365 days or infinite, and
      empty redirect URIs
    - revoke and revoke-all are idempotent
    - cleanup deletes only rows past retention (keeping consumed and
      superseded refresh tokens until their own expiry), removes unused
      clients after 24 hours, never deletes a client that has grants, and
      revokes grants idle for 30 days, skipping a grant locked by a request
      in flight
    - 20 parallel exchanges of one code → exactly one success; 6 parallel
      refreshes of one token → one live successor
    - an exchange in flight and cleanup don't deadlock; code creation and
      exchange racing a client delete return `invalid_client` and
      `invalid_grant`, not an FK error

## Task 2: Secrets, redirect URIs, registration and metadata
- [x] 2.1: Generalize `lib/auth/agent-token.ts` into a shared prefixed-secret
  helper (`generatePrefixedSecret`, `hasValidPrefixedSecretFormat`,
  `hashSecret`). The PAT functions become wrappers with unchanged behavior.
- [x] 2.2: `lib/auth/oauth/redirect-uri.ts`:
  - registration-time validation: https unless the host is ours, loopback
    http, private-use schemes checked against the denylist, no fragments
  - matching: exact, except that the port is ignored for loopback URIs
  - display text
- [x] 2.3: `lib/auth/oauth/resource.ts`: normalize a resource and check it
  against the accepted origins.
- [x] 2.4: `lib/auth/oauth/clients.ts`:
  - `registerClient`: SDK schema, then our rules; stores `grant_types`;
    sanitizes the name (control and bidi characters stripped, code-point
    truncation); issues a secret when the auth method needs one
  - `authenticateClient`: none, Basic (form-decoded) or post; the method must
    match the registration; compares digests timing-safely
- [x] 2.5: `app/api/oauth/register/route.ts`:
  - POST and OPTIONS, CORS, 16 KB body cap
  - per-IP and global rate limits, failing closed with 503
  - RFC 7591 success and error bodies
  - OAuth-enabled check
  - `mcp_oauth_client_registered` sent after the response
- [x] 2.6: The metadata routes:
  - `app/.well-known/oauth-authorization-server/route.ts`
  - `app/.well-known/oauth-protected-resource/route.ts`
  - `app/.well-known/oauth-protected-resource/api/mcp/route.ts`

  All three use the accepted-origins logic, CORS with `Allow-Headers`, a
  60-second cache and the OAuth-enabled check.
- [x] 2.7: Write tests for Task 2:
  - PAT suites unchanged and green; the new prefixes round-trip
  - the redirect URI matrix: https, our own host rejected, loopback with and
    without a port, `http://example.com` rejected, `cursor://` accepted,
    every denylisted scheme rejected, fragments, count and length limits
  - loopback matching ignores the port; non-loopback matching is exact
  - resource normalization: trailing slash, host case, default port,
    `www` when configured, foreign resources rejected
  - registration: `none` gets no secret; post and basic get a secret; name
    handling (default, emoji truncated at a code-point boundary, bidi
    characters stripped); `grant_types` stored and defaulted; unknown fields
    not echoed; 429 from the per-IP and global limits; Redis down → 503;
    OAuth disabled → 404
  - client authentication: every method; a URL-encoded Basic secret; method
    mismatch, wrong secret or unknown client → 401 with
    `WWW-Authenticate: Basic` when Basic was used
  - metadata: validates against the SDK schemas, the issuer is fixed, the
    resource follows the allowlist and falls back for a spoofed Host, CORS
    preflight headers, 404 on a preview deployment

## Task 3: Authorize handler, consent screen, consent API and sign-in path
- [x] 3.1: `lib/auth/oauth/authorize-params.ts`: one validator returning
  `fatal`, `redirect_error` (with a code) or `ok` (with canonical params, the
  normalized resource and the known scopes requested), plus a canonical-query
  builder.
- [x] 3.2: `app/oauth/authorize/route.ts`: fatal → `/oauth/error`; redirect
  errors → the client, with `error`, `state` and `iss`; signed out → login with
  the canonical `redirectTo`; signed in → `/oauth/consent?`.
- [x] 3.3: `app/oauth/error/page.tsx`: a static card.
- [x] 3.4: Extract the scope picker and expiry select from
  `components/careerotter/agent-token-create-form.tsx` into a shared component,
  with an optional "Requested by the app" label. The token form uses it
  unchanged.
- [x] 3.5: `app/oauth/consent/page.tsx`:
  - force-dynamic; awaits `searchParams`; OAuth-enabled check; revalidates
  - new accounts (`isNewUser`) are redirected to
    `/onboarding/welcome?next=<consent URL>` before rendering
  - renders the unverified notice, the return destination, `client_uri` only
    on the redirect's host, the email and a sign-out link, and the shared
    picker (PAT defaults, requested scopes labelled)
  - shows the replaces-access note, the cap message, Approve and Deny, and the
    no-account line
- [x] 3.6: The consent form client component: posts JSON, shows messages for
  400, 409 and 5xx, and navigates to `redirectUrl`.
- [x] 3.7: `app/api/oauth/authorize/route.ts`:
  - OAuth-enabled check, session cookie only, JSON content type and
    same-origin `Origin`
  - revalidates the request and applies the scope and expiry rules
  - calls `create_agent_oauth_code`, returning 409 at the cap
  - builds the approve and deny redirect URLs with `URLSearchParams`,
    keeping the existing query
- [x] 3.8: Sign-in and sign-up path:
  - the signup page reads `redirectTo` and passes it to its Google button and
    to `SignUpForm`
  - `signUpWithPassword` takes an optional `redirectTo`, validated
    server-side, and sets `emailRedirectTo` to `/auth/callback?next=…`
  - with no confirmation needed, the sign-up form goes to `redirectTo` ahead
    of its other branches
  - the login and signup cross-links carry `redirectTo`
  - `onboarding/welcome` honors a validated `next` on its non-checkout exits
  - the login page awaits `searchParams`, validates `redirectTo` and passes it
    to the Google button
  - the sign-in form prefers a valid `redirectTo` over onboarding
  - the middleware's rule for a signed-in user on `/login` honors a valid
    `redirectTo`
- [x] 3.9: `next.config.mjs`: set `frame-ancestors 'none'` and
  `X-Frame-Options: DENY` for `/oauth/:path*`, merged with
  `agentDiscoveryHeaders()`.
- [x] 3.10: Write tests for Task 3:
  - validator matrix:
    - an unknown client, an unregistered or missing redirect → fatal
    - a loopback URI on a different port → ok
    - `plain` or a missing challenge → `invalid_request`
    - a wrong `response_type` → `unsupported_response_type`
    - a foreign resource → `invalid_target`
    - an absent resource → the canonical resource
    - `openid` and `offline_access` ignored
    - an overlong `state` or `scope` → `invalid_request`
  - handler: every branch's redirect target; the canonical `redirectTo` stays
    under the size budget and passes `isValidInternalPath` even when the
    original parameters were unencoded
  - consent page: defaults are wins read/write even when all five scopes are
    requested, with the requested ones labelled; `client_uri` hidden when it's
    on another host; the cap message has no Approve button
  - API:
    - approve returns `code`, `state` and `iss`, keeping the redirect's own
      query
    - deny returns `access_denied`
    - comp scopes without an expiry → 400
    - a foreign `Origin` → 403
    - OAuth disabled → 404
    - at the cap → 409
  - sign-in path: the login page passes `redirectTo` to Google; the sign-in
    form prefers it; the middleware `/login` redirect honors it
  - sign-up path:
    - the confirmation link carries `next`
    - an absolute or protocol-relative `redirectTo` is dropped server-side
    - with no confirmation needed, the form goes to `redirectTo`
    - the signup Google button gets `redirectTo`
  - consent page: a new account is sent to onboarding with the consent URL as
    `next`, and an existing account sees consent
  - onboarding: a valid `next` is used on the free-plan exit and on the
    already-paid redirect, and an invalid one falls back to `/dashboard`
  - the framing headers are present
  - the token-form suites stay green

## Task 4: Token and revocation endpoints, cleanup cron
- [x] 4.1: `lib/auth/oauth/pkce.ts`: verifier charset and length checks, and a
  timing-safe comparison of the S256 challenge.
- [x] 4.2: `lib/auth/oauth/tokens.ts`:
  - `exchangeAuthorizationCode`: loads the code, verifies PKCE, checks the
    resource, then calls the RPC
  - `refreshTokens`: checks resource, scope and grant type, then calls the RPC
  - `lookupAccessToken`: returns `active`, `expired`, `revoked` or
    `not_found`
  - `touchGrantLastUsed`: throttled
- [x] 4.3: `app/api/oauth/token/route.ts`:
  - form parsing, a 16 KB body cap, CORS, `no-store` and `Pragma`
  - client authentication
  - both grant types, with the real `expires_in`
  - `grant_cap` → `invalid_grant` with a description
  - the per-client limit, charged only after client authentication succeeds,
    and the per-IP limit, the only one a failed authentication is charged
    to; 429 with `Retry-After`
  - RFC error bodies and security logs
  - `mcp_oauth_connected` on the first exchange
- [x] 4.4: `app/api/oauth/revoke/route.ts` (RFC 7009).
- [x] 4.5: `app/api/cron/agent-oauth-cleanup/route.ts`: `verifyCronAuth`, gated
  on `CAREEROTTER_ENABLED`, treats `42883` as a no-op, and has a daily entry in
  `vercel.json`.
- [x] 4.6: Write tests for Task 4:
  - PKCE: the RFC 7636 appendix B vector passes; a wrong verifier, a short
    verifier or a bad charset fails
  - token endpoint:
    - a successful exchange: response shape, `expires_in` of 86400 capped by the grant's
      expiry, the scope string, `no-store`, no refresh token for a client that
      didn't register that grant type
    - `invalid_grant` with no revocation for: a wrong verifier, a wrong
      `redirect_uri`, an expired code, another client's code
    - reusing a code after a successful exchange revokes the grant
    - refresh rotates; a grace-window reuse succeeds and the earlier
      successor stops working; presenting the superseded token revokes; a
      later reuse revokes
    - refresh with a wider `scope` → `invalid_scope`; a foreign resource →
      `invalid_target`
    - an unsupported grant type
    - a confidential client with no secret → 401
    - 429 with `Retry-After`
    - failed authentication using another client's `client_id` doesn't
      consume that client's per-client quota (only the per-IP bucket is
      charged)
    - OAuth disabled → 404
  - revocation: revokes the grant; unknown token → 200; another client's token
    → 200 and nothing revoked
  - cron: requires auth, calls the function, `42883` is a no-op

## Task 5: OAuth tokens at the MCP route
- [x] 5.1: `app/api/mcp/route.ts`:
  - `co_oat_` dispatch, the lookup under the abortable deadline, and the
    per-grant rate limit
  - failure accounting: with OAuth on, a missing header isn't counted and
    `co_oat_` failures go only to `oauthFailPerIp`; with it off, nothing
    changes
  - `WWW-Authenticate` with `resource_metadata` and the `scope` hint, plus
    `error="invalid_token"` when a token was presented
  - touch and rate-limit calls branch on `credentialKind`
- [x] 5.2: `lib/mcp/context.ts`: add `credentialKind` and document `tokenId`.
  `lib/mcp/define-tool.ts`: add `credentialKind` to analytics. Server
  instructions: tell the agent to have the user reconnect when it needs more
  scopes.
- [x] 5.3: `middleware.ts`:
  - `isCareerotterSurface` gains the new paths
  - the OAuth-enabled gate
  - matcher entries for `/api/oauth/:path*` and the cleanup cron
  - the early return extended to `/.well-known/oauth-*` and `/api/oauth/*`
- [x] 5.4: Write tests for Task 5:
  - an active `co_oat_` token gets exactly its grant's tools
  - expired, revoked, not-found and bad-checksum tokens get 401 with the right
    `WWW-Authenticate`
  - 50 failures from one IP with stale `co_oat_` tokens don't lock out a PAT or
    a valid OAuth token from that IP
  - a missing header isn't counted with OAuth on, and is counted with it off
  - with OAuth off, `co_oat_` gets today's 401, byte for byte
  - a preview deployment behaves as if OAuth were off
  - a lookup timeout → 503
  - a grant id never reaches `touchLastUsed`
  - the PAT suites stay unchanged and green
  - negative containment (goal 2): a `co_oat_` token is rejected by
    `getAuthenticatedUser` (the extension bearer path) and by the agent-token
    API, and Supabase `getUser` with it as the JWT yields no user (mocked
    GoTrue)
  - the middleware gate matrix for both flags and preview

## Task 6: Connected apps UI and API
- [ ] 6.1: `app/api/careerotter/agent-grants/route.ts` (GET, OAuth-gated) and
  `[id]/route.ts` (DELETE). Both accept a session cookie only.
- [ ] 6.2: The existing revoke-all route:
  - also revokes grants, regardless of the flag
  - treats `42883` as zero grants revoked
  - on a partial failure, returns 500 with the counts
- [ ] 6.3: The `lib/client/agent-grants.client.ts` wrapper, the "Connected apps"
  list, and the "Sign in with your browser" setup option. The flag reaches them
  as a prop from `app/(app)/dashboard/data/page.tsx`.
- [ ] 6.4: Write tests for Task 6:
  - the list shape and its 30-day window
  - OAuth disabled hides the list and the option
  - revoke: success; a foreign or missing id → 404
  - revoke-all covers both kinds, handles a missing function, and reports a
    partial failure
  - the UI asks for confirmation before revoking and shows the loopback text
  - the snippets contain the MCP URL and no token

## Task 7: Docs made inaccurate
- [ ] 7.1: `docs/agent-discovery.md`: rewrite "Not published: OAuth, auth.md, and
  MCP". With OAuth enabled, CareerOtter is the OAuth authorization server for
  `/api/mcp` and serves the three `.well-known` documents. It still has no
  `openid-configuration`, and `co_pat_` tokens remain.
- [ ] 7.2: `.claude/ship/phase2-LAUNCH-CHECKLIST.md`, in order:
  - step 0: turn off the Supabase OAuth server and dynamic registration
  - run migration 045
  - confirm Supabase's redirect allow-list accepts `/auth/callback?next=…`
  - set the flag in production
  - real-client tests, confirming each registers via DCR: Claude.ai connector,
    Claude Desktop, Claude Code `/mcp`, Cursor, MCP Inspector
  - register `co_oat_`, `co_ort_` and `co_cs_` with GitHub secret scanning,
    alongside `co_pat_`
  - confirm the cleanup cron runs
- [ ] 7.3: Write tests for Task 7: none for prose. Confirm every path, flag and
  prefix the docs name exists in code.

## Known trade-offs
- A new user who picks a paid plan during onboarding has to reconnect from the
  app. So does one whose app stopped waiting during a slow email confirmation.
- A double-submitted code exchange revokes the grant it just created, as the
  spec requires.
- Only dynamic registration is supported; Client ID Metadata Documents are a
  follow-up.
- There's no step-up (`insufficient_scope`). To get more scopes, the agent asks
  the user to reconnect.
- Consumed refresh tokens are kept until they expire, so reuse is detected for
  the refresh token's whole lifetime. With 24-hour access tokens that's about
  30 rows per grant.
- The metadata's 60-second cache can outlive the kill switch by up to a minute;
  the endpoints themselves stop immediately.
