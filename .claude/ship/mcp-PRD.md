# PRD: CareerOtter MCP server (wins + comp)

Feature: a remote MCP server that lets a user's own AI agent (Claude Code, Claude
Desktop, Cursor, a personal-finance harness) read and write that user's CareerOtter
wins and comp data, authenticated with personal access tokens the user creates and
revokes in the app.

## Problem Statement

CareerOtter's evidence loop depends on capture. The capture bar is fast, but it
only works when the user remembers to open it, and most shippable work happens
somewhere else: in a PR, a design doc, a meeting. The agents people already run
while doing that work can see it happen, but have no way to write it down
anywhere durable. The same is true for comp: people increasingly run personal
finance through AI harnesses, and their CareerOtter comp history (base, bonus,
equity grants with vesting, projections) is locked behind the web UI.

Today there is no programmatic access at all. `llms.txt`, the
`careerotter-public-api` agent skill and `docs/agent-discovery.md` all say so
explicitly. Every `/api/` route authenticates with a Supabase session cookie.

Affected: every CareerOtter account holder who uses an AI agent. It matters now
because the wins and comp surfaces are complete and approaching launch, and
agent-driven capture is the cheapest way to raise wins logged per user, which is
the metric the whole Pro upgrade path sits on.

## Goals

1. A user can create a named personal access token with chosen scopes in under a
   minute from `/dashboard/data`, see it exactly once, and revoke it; a revoked
   token is rejected on its next request.
2. With that token, an MCP client connected to `/api/mcp` can:
   - log a win, list wins, read coverage and career context;
   - list, add, update and delete comp entries, read a comp summary and
     multi-year projection, read cached quotes for the user's own tickers, read
     the market benchmark (Pro only), and evaluate a hypothetical offer without
     saving it.
3. Every tool enforces its scope server-side; a token without `comp:read` cannot
   read any comp field through any tool.
4. Wins and comp entries written by an agent are marked `source = 'agent'` and
   can carry an `external_ref`; re-submitting the same `external_ref` does not
   create a duplicate row.
5. The REST routes and MCP tools share one validation and persistence path per
   domain, so a rule change (e.g. a new comp field limit) is made once. Existing
   `/api/wins` and `/api/careerotter/comp` behavior and tests are unchanged.
6. The server is dark unless `CAREEROTTER_ENABLED=1`, like every other
   CareerOtter surface.
7. Measurable after launch: PostHog `mcp_tool_called` (tool name, success) and
   `win_logged` with `source: 'agent'`, so agent share of wins logged is a
   single query.

## Non-Goals

- OAuth 2.1 / MCP authorization-spec flows, Protected Resource Metadata, and
  listing as a Claude.ai connector. Tokens are pasted into clients that support
  custom headers. OAuth is the follow-up once usage justifies it.
- A candidate/suggestion inbox (`win_candidates`) and any agent that gathers
  work from GitHub, Calendar, Slack, etc. Agents write straight to the log.
- A Claude Code plugin, `/win` command, or hooks.
- Model-backed tools (case drafting, coach). No tool calls an LLM.
- MCP resources and prompts. Tools only.
- Multi-grant equity (`comp_grants`), discrete vest events, bonus target vs
  actual, and non-USD currency. MCP comp writes are USD, like the web form.
- A REST `PATCH /api/careerotter/comp/:id`. Update exists in the shared service
  and in MCP only.
- Changing recap, coverage or the "Recently" list to key off `occurred_at`.
  `occurred_at` is stored and returned; consumers stay on `created_at`.
- Signed-in WebMCP tools in `components/agents/webmcp-provider.tsx`.
- Upgrading the project to zod 4 (see Technical Approach, library choice).

## User Stories

1. As an engineer using Claude Code, I want to say "log this PR as a win" at the
   end of a session so that the work is in my promo evidence without switching
   to a browser.
2. As a user preparing for a review, I want my agent to read my coverage and
   career context so that it can tell me which impact area is thin and what I
   shipped recently that belongs there.
3. As someone who runs personal finance through an AI harness, I want it to read
   my comp history and projections so that it can plan RSU income and tax
   withholding with the same numbers CareerOtter shows me.
4. As someone weighing an offer, I want my agent to compare the offer with my
   current package over four years at different share prices so that I get the
   same vesting math the comp page uses, without saving a hypothetical.
5. As a privacy-conscious user, I want wins access and comp access granted
   separately, with comp off by default, so that a coding agent I trust with my
   PR summaries never sees my salary.
6. As a user who lost a laptop, I want to revoke a token from the web app so
   that the agent on that machine stops working immediately.

## Technical Approach

### Library choice

`mcp-handler` 2.x requires `@modelcontextprotocol/server` 2.x, which requires
zod `^4.2`. This repo is on zod `^3.25.76` (and `ai`, `@hookform/resolvers`
depend on it). Use **`mcp-handler@1.1.0` with `@modelcontextprotocol/sdk@1.26.0`**,
pinned exactly (1.1.0 declares an exact peer on sdk 1.26.0), which accept zod
`^3.25 || ^4`. This serves 2025-era stateless Streamable HTTP. Clients speaking
the 2026-07-28 revision negotiate down to a version the server supports. The
implementer verifies `createMcpHandler` and auth-wrapper signatures against the
installed 1.1.0 source before coding, since 2.x docs are what npm shows today.

### Data model — migration `schemas/migrations/044_mcp_agent_access.sql`

- `agent_tokens`: `id uuid pk`, `user_id uuid → profiles(id) on delete cascade`,
  `name text not null` (1–60 chars), `token_hash text not null unique` (SHA-256
  hex of the full token), `token_prefix text not null` (first 12 chars, for
  display), `scopes text[] not null` (non-empty, each in the scope list,
  enforced by CHECK using `<@`), `created_at`, `last_used_at`, `expires_at`
  (nullable = never), `revoked_at` (nullable). Index on `(user_id)`. RLS
  enabled, no policies (service-role only, matches wins/comp).
- `wins`: add `occurred_at date`, `evidence_url text`, `external_ref text`; widen
  the `source` CHECK to include `'agent'`; partial unique index
  `(user_id, external_ref) where external_ref is not null`.
- `comp_entries`: add `source text not null default 'manual' check (source in
  ('manual','agent'))`, `external_ref text`, same partial unique index.
- Mirror constants: `WIN_SOURCES` gains `"agent"`; new `AGENT_TOKEN_SCOPES`,
  `COMP_SOURCES` and token limits in `lib/constants/careerotter.ts` (or a new
  `lib/constants/agent-access.ts`), and types in `/types` per CLAUDE.md.

### Tokens

- Format: `co_pat_` + 32 random bytes base64url (`crypto.randomBytes`). Only the
  SHA-256 hash is stored. Lookup is by hash equality through the unique index.
- Scopes: `wins:read`, `wins:write`, `comp:read`, `comp:write`. `*:write` does
  not imply `*:read`; the UI checks read when write is checked.
- Expiry choices: 30, 90 (default), 365 days, or never.
- Limit: 10 active (unrevoked, unexpired) tokens per user; creation rate limited
  with `createRateLimiter(10, "1 m")` like extension tokens.
- Why not reuse extension JWTs (`lib/auth/extension-auth.ts`): those revoke by
  bumping one per-user version (all-or-nothing), carry no scopes, and expire in
  7 days with a refresh dance. PATs need per-token revocation and scopes.
- `lib/auth/agent-token.ts`: `generateAgentToken()`, `hashAgentToken()`,
  `verifyAgentToken(raw) → { userId, tokenId, scopes } | null` (null for
  unknown, revoked or expired), and a best-effort `last_used_at` touch.

### Token API (session-auth only; a PAT can never mint or list PATs)

- `GET /api/careerotter/agent-tokens` → the user's tokens (never hashes).
- `POST /api/careerotter/agent-tokens` `{ name, scopes, expires_in_days }` →
  201 with the raw token once.
- `DELETE /api/careerotter/agent-tokens/:id` → sets `revoked_at`; 404 if not
  the caller's.

These sit under `/api/careerotter/`, so the existing launch gate covers them.

### UI

A "Connected agents" section on `/dashboard/data` (server page stays a server
component; one client component that calls the token API, per CLAUDE.md rule
4). Create form: name, scope checkboxes (wins read/write checked, comp
unchecked), expiry select. After creation it shows the token once with a copy
button and a ready-to-paste `claude mcp add --transport http careerotter
<origin>/api/mcp --header "Authorization: Bearer <token>"` line. The list shows
name, prefix, scopes, created, last used, expires, and a revoke button with a
confirm step. No badges-as-pills; scopes render as plain text. 44px targets.

### Shared domain services

- `lib/careerotter/wins-service.ts`: `validateWinInput`, `createWin`,
  `listWins` (optional date range and tag), each taking an admin client and a
  `userId`, returning a discriminated result (`{ ok: true, value } | { ok:
  false, kind: 'validation' | 'not_found' | 'conflict' | 'db', message }`).
  `/api/wins` and `/api/wins/[id]` are refactored onto it with identical HTTP
  behavior.
- `lib/careerotter/comp-service.ts`: `validateCompInput` (all rules currently
  inline in the comp POST, including `isIsoDate`, the shares bound, vest and
  cliff rules), `createCompEntry`, `updateCompEntry` (partial; re-validates the
  merged row so a cliff can't outlive a shortened vest), `deleteCompEntry`,
  `listCompEntries`. Comp routes refactored onto it.
- `external_ref` conflicts: on unique violation (`23505`) the service returns
  the existing row with `duplicate: true` rather than an error, so agent
  retries are idempotent.

### MCP route — `app/api/mcp/route.ts`

- `createMcpHandler` with `GET`/`POST` (and `DELETE`) exports, stateless, no
  SSE, `export const maxDuration` modest (30s). Node runtime (uses `crypto` and
  the admin client).
- Auth wrapper: read `Authorization: Bearer`, `verifyAgentToken`, 401 JSON-RPC
  error when missing/invalid. Do not emit a `resource_metadata` challenge
  pointing at a document that doesn't exist; if `withMcpAuth` in 1.1.0 forces
  one, write a small wrapper instead.
- Per-token rate limit: `createRateLimiter(120, "1 m")` keyed by token id; no-op
  when Redis is absent (existing behavior of `createRateLimiter`).
- Server `instructions`: what CareerOtter is; the four tag definitions; write win
  text as one or two plain first-person sentences; never invent an impact
  number that isn't in the source material, leave it empty instead; log a win
  only when the user asks or confirms; comp amounts are annual USD.
- Tools live in `lib/mcp/tools/{wins,comp}.ts` as plain functions
  `(ctx: { userId, scopes, admin, now }, input) → ToolResult` so they're unit
  testable without the transport; `lib/mcp/server.ts` registers them. Every
  tool has zod input schema, `outputSchema`, returns `structuredContent` plus a
  short text summary, and sets annotations (`readOnlyHint`, `destructiveHint`,
  `idempotentHint`).
- Scope check inside every tool (returns `isError` with the missing scope
  named). Additionally, if the adapter initializes the server per request with
  access to auth info, register only tools the token's scopes allow.

Tools:

| Tool | Scope | Notes |
|---|---|---|
| `log_win` | wins:write | text, impact_number?, tag?, occurred_at?, evidence_url? (http/https only), external_ref? → win, duplicate flag |
| `list_wins` | wins:read | since?, until?, tag?, limit (default 50, max 200) |
| `get_coverage` | wins:read | `computeCoverage` over all wins |
| `get_career_context` | wins:read | career_profiles mode/role/level/target/review_date + `reviewCountdown` |
| `list_comp_entries` | comp:read | all entries, oldest first |
| `get_comp_summary` | comp:read | latest entry by effective_date: `annualBreakdown`, `vestSummary`, anchor share price and its source (quote or implied) |
| `project_comp` | comp:read | entry_id? (default latest), years (default current + 3, max 10), share_price? → `projectComp` |
| `get_equity_quotes` | comp:read | cached quotes only for tickers in the user's entries (`loadQuotes`) |
| `get_market_benchmark` | comp:read | role_family, level; Pro only (`getUserPlanInfo`), else isError naming the plan |
| `evaluate_offer` | comp:read | 1–2 hypothetical packages (no id, not saved), years, share_price per package → projections + 4-year totals + delta |
| `add_comp_entry` | comp:write | same fields as web form, external_ref? |
| `update_comp_entry` | comp:write | id + partial fields |
| `delete_comp_entry` | comp:write | id; destructiveHint |

Analytics: `win_logged` (source `agent`) and `comp_entered` reuse existing
events through the shared services; new `MCP_TOOL_CALLED` in
`CAREEROTTER_EVENT_NAMES` with `{ tool, ok }`, fired via `after()`. No token or
user content in event properties.

### Launch gate

Add `/api/mcp` to `isCareerotterSurface` and the middleware `matcher` (API
routes are excluded from the matcher by default).

## Edge Cases & Risks

- **Token leakage.** Tokens are bearer credentials that grant salary access.
  Hash at rest, show once, per-token revoke, optional expiry, `last_used_at`
  visible, comp scopes off by default. Never log the raw token or the
  Authorization header.
- **Cross-user access.** The admin client bypasses RLS; every query must scope
  by `userId` from the verified token, never from tool input. Tool inputs have
  no `user_id` field. Tests assert `.eq("user_id", …)` on every path.
- **Scope bypass.** A tool added later without a scope check would leak. Tool
  registration goes through one helper that requires a scope argument.
- **Revocation latency.** No caching of token lookups; revocation is effective
  on the next request. Cost: one indexed lookup per MCP request.
- **Dark launch.** Middleware returns 404 unless `CAREEROTTER_ENABLED=1`.
- **Duplicate writes from agent retries.** `external_ref` unique index; a
  conflicting insert returns the existing row. Without `external_ref`, duplicates
  are possible, same as the web form.
- **Invented numbers.** Instructions forbid it; `impact_number` is free text
  capped at 120 chars, so it cannot be validated for truth. Agent-written wins
  are marked `source='agent'` so the UI can distinguish them later.
- **`evidence_url` abuse.** Accept only `http:`/`https:` URLs up to 2048 chars;
  never fetched server-side, so no SSRF surface.
- **Concurrent updates.** `update_comp_entry` is last-write-wins, matching the
  web app. Validation of cliff vs vest uses the merged row read in the same
  request; a race between two agents can still interleave, acceptable for a
  single-user dataset.
- **Large reads.** `list_wins` capped at 200; comp entries per user are small.
- **Price feed off.** `get_equity_quotes` and summaries fall back to the implied
  per-share price and say so (`price_source: 'implied'`), matching the page.
- **Non-Pro benchmark.** Return a tool error that names the requirement; do not
  return a partial or fabricated range.
- **Serverless cold starts / timeouts.** Stateless handler, no Redis session
  store, no long-running tools.
- **MCP version drift.** Pinned 1.x adapter serves 2025 Streamable HTTP. If a
  client requires 2026-07-28 only, it fails to connect; mitigation is the zod 4
  upgrade (open question 1).

## Open Questions

1. Upgrade to zod 4 and `mcp-handler` 2.x now, or later? Default: later, as its
   own change; this PR pins 1.x.
2. When should `llms.txt`, the `careerotter-public-api` skill and the discovery
   doc advertise the MCP server? Default: `docs/agent-discovery.md` describes it
   now (internal doc, describes code); `llms.txt` mentions it only when
   `CAREEROTTER_ENABLED=1`; the static skill file is updated as a launch
   checklist item, because its digest is published and it can't be conditional.
3. Should agent writes land in an inbox for confirmation instead of the log?
   Default: straight to the log, relying on the server instructions; revisit
   with the candidates inbox.
4. Should recap and coverage use `occurred_at` when present? Default: no, in
   this change.
