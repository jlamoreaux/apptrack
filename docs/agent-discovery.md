# Agent discovery

How CareerOtter presents itself to AI agents and registries: what the origin
publishes, where each document is generated, and the two categories of thing we
deliberately do not publish.

## What is published

| Resource | Standard | Source |
| --- | --- | --- |
| `Link:` response headers | [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) | `next.config.mjs` (`headers()`) |
| `/robots.txt` with `Content-Signal` | [contentsignals.org](https://contentsignals.org), `draft-romm-aipref-contentsignals` | `app/robots.txt/route.ts` |
| `/llms.txt` | de-facto convention | `app/llms.txt/route.ts` |
| `/openapi.json` | OpenAPI 3.1 | `app/openapi.json/route.ts` |
| `/.well-known/api-catalog` | [RFC 9727](https://www.rfc-editor.org/rfc/rfc9727) / [RFC 9264](https://www.rfc-editor.org/rfc/rfc9264) | `app/.well-known/api-catalog/route.ts` |
| `/.well-known/ai-catalog.json` | [ARD](https://agenticresourcediscovery.org) | `app/.well-known/ai-catalog.json/route.ts` |
| `/.well-known/agent-skills/index.json` | Agent Skills Discovery v0.2.0 | `app/.well-known/agent-skills/index.json/route.ts` |
| Markdown content negotiation | `Accept: text/markdown` | `middleware.ts` + `app/api/markdown/route.ts` |
| WebMCP tools | [webmachinelearning.github.io/webmcp](https://webmachinelearning.github.io/webmcp/) | `components/agents/webmcp-provider.tsx` |

While MCP OAuth is enabled, the three OAuth discovery documents are published
too; see "MCP server and OAuth" below.

Two things keep these honest and are worth preserving:

- **Nothing is hand-copied.** Pricing, tool lists, and blog entries come from the
  same constants the pages render (`lib/constants/homepage-content.ts`,
  `lib/constants/free-tools.ts`, `lib/blog.ts`). Skill digests are computed from
  the bytes on disk at build time, so editing a `SKILL.md` updates the index.
- **Only IANA-registered link relations appear in the `Link` header.** A bare
  token that isn't registered is not a conforming relation type.

### Adding an agent skill

1. Create `content/agent-skills/<name>/SKILL.md` with YAML frontmatter (`name`,
   `description`).
2. Add the name and description to `AGENT_SKILLS` in
   `lib/agent-discovery/skills.ts`.

The index entry, digest, `/.well-known/agent-skills/<name>/SKILL.md` route, and
the ARD manifest entry all follow automatically.
`__tests__/agent-discovery/discovery-documents.test.ts` fails if a declared skill
has no file, or if a published digest stops matching what is served.

### Adding a markdown rendering

Add the path to `STATIC_MARKDOWN_PATHS` in
`lib/agent-discovery/markdown-negotiation.ts` and a case to
`renderMarkdownPage` in `lib/agent-discovery/markdown-pages.ts`. Blog posts are
already covered — they render from their MDX source.

Pages whose copy lives only in JSX (`/privacy`, `/terms`, the role landing
pages) are deliberately absent. They keep serving HTML rather than a
hand-written summary that would silently go stale.

## Not published: DNS-AID

DNS for AI Discovery ([`draft-mozleywilliams-dnsop-dnsaid-02`](https://datatracker.ietf.org/doc/html/draft-mozleywilliams-dnsop-dnsaid-02)) is the one item here
that cannot live in this repository — it is zone configuration, applied wherever
`careerotter.io` DNS is hosted.

To publish it, add ServiceMode SVCB records under `_agents`:

```
; Well-known entry point. Points agents at the origin serving the
; ARD manifest and the rest of the /.well-known documents.
_index._agents.careerotter.io. 3600 IN SVCB 1 careerotter.io. (
                                 alpn="h2,http/1.1"
                                 port=443
                                 well-known="ai-catalog.json"
                                 mandatory=alpn )
```

Notes before doing this:

- Alongside the RFC 9460 keys (`alpn`, `port`, `ipv4hint`, `ipv6hint`,
  `mandatory`), draft `-02` defines six of its own: `well-known` (an RFC 8615
  path, with the `.well-known/` prefix assumed — hence `ai-catalog.json` above,
  not the full path), `cap` and `cap-sha256` (a capability descriptor locator
  and the base64url SHA-256 digest of its canonical form), `policy`, `realm`,
  and `bap`.
- **Those six have no numeric code points yet.** The draft defers assignment to
  IANA under Standards Action, so today they can only be published as
  experimental `key65xxx` numbers that no two implementations agree on. That,
  not a gap in the draft, is the reason to wait.
- The schema of the organization index that `_index._agents` points at is out of
  scope for the draft. CareerOtter would serve `/.well-known/ai-catalog.json`,
  which is what the ARD manifest above already is.
- `_mcp._agents` should **not** be added until the MCP server launches (see
  below); before then it would advertise an endpoint that 404s. `_a2a._agents`
  should not be added at all: there is no A2A agent.
- The draft asks that the discovery zone be DNSSEC-signed so validating
  resolvers return authenticated data. Signing `careerotter.io` is a
  registrar/DNS-host operation, not a code change.

## MCP server and OAuth

CareerOtter has a remote MCP server at `/api/mcp` (`app/api/mcp/route.ts`):
Streamable HTTP, stateless, JSON-RPC over POST. Each POST response is a
single `text/event-stream` message, so clients must send
`Accept: application/json, text/event-stream`; there is no standalone GET SSE
stream (GET returns 405). The route answers OPTIONS with 405 and a foreign
`Origin` with 403 (DNS rebinding protection), so browser-only clients can't
call it directly.

It accepts two kinds of bearer token, dispatched on the prefix:

- **Personal access tokens** (`co_pat_`, verified by `lib/auth/agent-token.ts`),
  which an account holder creates and revokes on `/dashboard/data` and pastes
  into a client config. They stay, because scripts, cron jobs and server-side
  harnesses can't complete a browser sign-in.
- **OAuth access tokens** (`co_oat_`), issued by CareerOtter's own OAuth 2.1
  authorization server when a client connects by URL alone. Only while OAuth
  is enabled (see "Gating"); with it off, a `co_oat_` token takes the PAT path
  and is refused like any other bad token.

Both carry scopes from `AGENT_TOKEN_SCOPES` in `lib/constants/agent-access.ts`
(`wins:read`, `wins:write`, `career:read`, `comp:read`, `comp:write`; a write
scope implies its read scope), and the server registers only the tools in
`lib/mcp/tools/` that the scopes allow. An OAuth token can do what a PAT with
the same scopes can do and nothing else: it is an opaque random string stored
as a SHA-256 hash, not a Supabase credential, and it works only at `/api/mcp`.
There is no step-up (`insufficient_scope`): an agent that needs more scopes
asks the user to reconnect, or to create a token with the access needed.

### Gating

`middleware.ts` returns 404 for `/api/mcp` (and the token API) unless
`CAREEROTTER_ENABLED=1`. The OAuth surfaces also need
`isMcpOAuthEnabled()` (`lib/constants/agent-oauth.ts`), which is true only
when all of these hold:

- `CAREEROTTER_ENABLED=1`
- `CAREEROTTER_MCP_OAUTH_ENABLED=1`
- `VERCEL_ENV` is not `preview`. On a preview the issuer would still be the
  production origin, and previews may share the production database, so OAuth
  is off there whatever the flag says.

When it is false, the `.well-known/oauth-*` documents, `/oauth/*` and
`/api/oauth/*` return 404 (in middleware and again in each handler), and every
MCP 401 is the plain `WWW-Authenticate: Bearer error="invalid_token"` with no
`resource_metadata`. The cleanup cron is gated on `CAREEROTTER_ENABLED` only,
so rows keep getting cleaned up while the OAuth flag is off.

The metadata documents are cached for 60 seconds
(`Cache-Control: public, max-age=60`), so after the flag is turned off
discovery can outlive it by up to a minute. The endpoints themselves stop at
once.

### Discovery documents

Published only while OAuth is enabled. All are generated from
`lib/auth/oauth/metadata.ts`, answer GET and OPTIONS with CORS `*`, and are
cached for 60 seconds.

| Resource | Standard | Source |
| --- | --- | --- |
| `/.well-known/oauth-protected-resource/api/mcp` | [RFC 9728](https://www.rfc-editor.org/rfc/rfc9728) | `app/.well-known/oauth-protected-resource/api/mcp/route.ts` |
| `/.well-known/oauth-protected-resource` (root fallback, same body) | RFC 9728 | `app/.well-known/oauth-protected-resource/route.ts` |
| `/.well-known/oauth-authorization-server` | [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414) | `app/.well-known/oauth-authorization-server/route.ts` |

- **Issuer.** Always `SITE_URL` (from `NEXT_PUBLIC_APP_URL`, default
  `https://careerotter.io`). The authorization server metadata is the same on
  every host, and every endpoint URL in it is absolute on `SITE_URL`.
  `NEXT_PUBLIC_APP_URL` is inlined at build time, so changing it needs a
  redeploy.
- **Resource.** The protected resource document's `resource` is
  `<origin>/api/mcp`, where `<origin>` is the request's origin when it is
  accepted and `SITE_URL` otherwise. The accepted origins are `SITE_URL` plus
  any listed in the optional, comma-separated `CAREEROTTER_MCP_EXTRA_ORIGINS`.
  A spoofed `Host` header can't change what is advertised, and the document
  sends `Vary: Host, X-Forwarded-Host`.
- The authorization server metadata advertises `response_types_supported:
  ["code"]`, `grant_types_supported: ["authorization_code", "refresh_token"]`,
  `code_challenge_methods_supported: ["S256"]`, the auth methods `none`,
  `client_secret_basic` and `client_secret_post` (token and revocation), the
  five scopes, and `authorization_response_iss_parameter_supported: true`.

### The 401 challenge

With OAuth enabled, every 401 from `/api/mcp` carries:

```
WWW-Authenticate: Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource/api/mcp", scope="wins:read wins:write"
```

`<origin>` is chosen as for `resource` above. The `scope` hint makes SDK-based
clients request the PAT defaults rather than every supported scope. When a
bearer token was presented, the challenge also carries
`error="invalid_token"` and an `error_description` of "The access token is
invalid", "The access token has expired" or "The access token has been
revoked" (`MCP_BEARER_FAILURE_DESCRIPTIONS`). A request with no
`Authorization` header at all is the discovery probe: its body is
`{"error":"unauthorized"}` and it isn't counted as an auth failure. Every other
401 body is `{"error":"invalid_token"}`.

`co_oat_` failures don't count toward the PAT lockout (30 per IP per minute),
since Claude.ai users share egress IPs and a returning user's stale token is
normal. They count toward a separate 600 per IP per minute limit that bounds
database lookups. An OAuth grant gets the same per-credential rate limit as a
PAT (300 requests per minute).

### Endpoints

| Purpose | Path | Spec |
| --- | --- | --- |
| Dynamic client registration | `POST /api/oauth/register` | [RFC 7591](https://www.rfc-editor.org/rfc/rfc7591) |
| Authorization request | `GET /oauth/authorize` (validates, then redirects to login or consent) | OAuth 2.1 |
| Consent screen | `GET /oauth/consent` | internal |
| Consent decision | `POST /api/oauth/authorize` (session cookie, same-origin JSON) | internal |
| Token | `POST /api/oauth/token` | OAuth 2.1 |
| Revocation | `POST /api/oauth/revoke` | [RFC 7009](https://www.rfc-editor.org/rfc/rfc7009) |
| Cleanup cron | `GET /api/cron/agent-oauth-cleanup` (`CRON_SECRET`, daily at 03:30 UTC in `vercel.json`) | internal |

Handlers live under `app/oauth/` and `app/api/oauth/`, with the logic in
`lib/auth/oauth/` and the tables and functions in
`schemas/migrations/045_mcp_oauth.sql`.

- **Registration.** Dynamic registration is the only way to get a
  `client_id`; Client ID Metadata Documents are a follow-up. Redirect URIs
  (1 to 5, each at most 512 characters) are stored exactly as sent and must be
  one of: https on a host that isn't ours (neither an accepted MCP origin nor
  a legacy host); `http://` on exactly `127.0.0.1`, `[::1]` or `localhost` in
  lowercase (any port, and matched ignoring the port); or a private-use scheme
  of three or more characters outside a denylist.
  `token_endpoint_auth_method` is `none` (the default), `client_secret_basic`
  or `client_secret_post`; the secret methods get a `co_cs_` client secret,
  returned once. `grant_types` must include `authorization_code`; omitting it
  registers both `authorization_code` and `refresh_token`. Registration's own
  limits are 30 per IP per 10 minutes, 100 per IP per day and 2,000 per day
  overall. Like the token and revocation endpoints, it fails closed with 503
  when Redis is unavailable. A client that never completes an authorization
  is deleted by the daily cleanup once it is 24 hours old and holds no
  unexpired code.
- **Authorization.** PKCE with `S256` is required (a 43-character
  `code_challenge`). A `resource` parameter, when present, must normalize to
  an accepted `<origin>/api/mcp`, or the client gets `invalid_target`; when
  absent, the grant is for `SITE_URL`'s resource. Every authorization response
  carries `iss` (RFC 9207). Unknown or invalid client ids and redirect URIs are
  shown an error page, never redirected.
- **Consent.** The user sees the app's name, marked unverified, and where it
  will send them back, then picks scopes and an expiry under the PAT rules:
  defaults `wins:read` and `wins:write` whatever the app requested, an expiry
  of 30, 90 or 365 days or never (default 90; never isn't allowed with a comp
  scope). A user can have at most 10 connected apps; approving an app that is
  already connected replaces its grant. Signing up mid-flow (email or Google)
  and free onboarding carry the request through to consent.
- **Token.** `grant_type` is `authorization_code` or `refresh_token`. The
  token and revocation endpoints share both rate limits: 60 requests per
  minute per client, charged after client authentication succeeds (a public
  client's bucket is split per caller IP), and 600 failed client
  authentications per minute per IP. Both fail closed with 503
  `temporarily_unavailable` when Redis is unavailable. Refresh tokens are
  issued only to clients whose registration includes the `refresh_token`
  grant, which it does when `grant_types` was omitted.
- **Revocation.** Revoking either the access or the refresh token revokes the
  whole grant. Once the client authenticates, it answers 200 with an empty
  body, including for unknown tokens and other clients' tokens, which it
  leaves alone. Failed client authentication gets 401 `invalid_client`, and a
  missing `token` parameter 400 `invalid_request`. `token_type_hint` is
  ignored.

The registration, token and revocation endpoints send CORS headers (`*`), so a
browser-based OAuth flow such as MCP Inspector's can complete.

### Tokens and lifetimes

All use the PAT construction (`lib/auth/prefixed-secret.ts`): the prefix, 32
random bytes in base64url, `_` and a 7-character base36 CRC32 checksum. Only
SHA-256 digests are stored.

| Kind | Prefix | Lifetime |
| --- | --- | --- |
| Access token | `co_oat_` | 24 hours, capped at the grant's expiry |
| Refresh token | `co_ort_` | 30 days from issue, capped at the grant's expiry; rotated on every use |
| Authorization code | `co_code_` | 5 minutes, single use |
| Client secret | `co_cs_` | no expiry |
| Client id | `co_client_` + 16 random bytes in base64url | public identifier, stored as is |

The lifetimes are `constant interval` declarations in migration 045, mirrored
by `AGENT_OAUTH_LIFETIME_SECONDS` and guarded by a test. Every expiry is
computed in Postgres with `now()`.

- A refresh token used again within 60 seconds of its rotation gets a fresh
  pair, up to 5 times, as long as no refresh token issued from it has been
  used yet. Each reissue invalidates the pairs issued from it before. This
  covers parallel refreshes by one client. Any other reuse of a rotated
  refresh token, and any reuse of an authorization code by the client holding
  its PKCE verifier, revokes the grant.
- Rotated refresh tokens are kept until their own expiry, so reuse is detected
  for the refresh token's whole lifetime.
- A grant that never expires is revoked by the daily cleanup once it has gone
  30 days without use.
- Access tokens last 24 hours rather than the usual hour because every MCP
  request looks the token up, so revoking a grant takes effect on the next
  request whatever the access token's expiry.

Users see and revoke connected apps in the "Connected apps" list on
`/dashboard/data`. "Revoke all agent access" revokes every token and every
connected app, whether or not OAuth is currently enabled, so turning the flag
off and on again can't revive a grant the user revoked.

### Connecting by URL

A client connecting with OAuth must use the MCP URL on the canonical
`SITE_URL` host, `https://careerotter.io/api/mcp` in production, or on an
origin listed in `CAREEROTTER_MCP_EXTRA_ORIGINS`. The dashboard's "Sign in
with your browser" snippets always use that URL (`CANONICAL_MCP_RESOURCE`).

On any other host, including the legacy `apptrack.ing` hosts and Vercel
deployment aliases, `/api/mcp` still answers, but OAuth can't complete: the
401 and the protected resource metadata name `SITE_URL`'s resource, which
doesn't match the URL the client connected to, and the authorization server
refuses a `resource` on that host with `invalid_target`. Bearer tokens still
work there, personal access tokens and already-issued OAuth access tokens
alike: `/api/mcp` doesn't check a token's resource, so only the OAuth flow
itself is tied to the canonical host.

## Not published

These commonly-audited documents are intentionally absent:

- **`/.well-known/openid-configuration`.** CareerOtter is an OAuth 2.1
  authorization server for `/api/mcp` only, not an OpenID provider. It issues
  no ID tokens, and MCP needs OAuth only. Web sign-in remains a Supabase
  session cookie obtained by the first-party app.
- **`/auth.md`.** Its purpose is agent registration instructions. Agents
  register through the dynamic registration endpoint advertised in the
  authorization server metadata (while OAuth is enabled), or a person creates
  a token and hands it to their agent; neither needs a prose document.
- **`/.well-known/mcp/server-card.json`.** Not published yet. It should describe
  a server clients can actually reach, so it is a launch follow-up to decide
  alongside the DNS-AID `_mcp._agents` record, once `CAREEROTTER_ENABLED` is on
  in production. The in-browser WebMCP tools in
  `components/agents/webmcp-provider.tsx` are a different thing and remain
  public-only: they run in the user's tab, expose no signed-in data, are not
  reachable over the network, and are not described by a server card.

While the server is dark, nothing advertises it: `/llms.txt`,
`/openapi.json` and `/.well-known/api-catalog` do not mention it, because a
discovery document that points at a 404 is worse than none.
