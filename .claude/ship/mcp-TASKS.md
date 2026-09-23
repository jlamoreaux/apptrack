# Task Breakdown: CareerOtter MCP server (wins + comp)

PRD: `.claude/ship/mcp-PRD.md`

Stack: TypeScript / Next.js 15.2 App Router, Supabase, pnpm.
- Type check: `npx tsc --noEmit`. Baseline 378 errors; gate = no new errors.
- Tests: `npx jest`. Baseline: 4 suites already failing on main
  (`stripe-status-map`, `stripe-trial-will-end`, `stripe-webhook`,
  `services/ai-generation`); gate = no new failures.
- Lint: `pnpm lint` (next lint). No formatter configured; match the surrounding
  style.

## Task 1: Migration, constants and types
- [x] 1.1: Write `schemas/migrations/044_mcp_agent_access.sql`:
  - the `agent_tokens` table with checks and indexes
  - on `wins`: `occurred_at` NOT NULL with backfill and index, `evidence_url`,
    `external_ref`, the partial unique index
  - on `wins`: drop the source check by its name looked up in `pg_constraint`,
    re-add a named check including `'agent'`, and a `do $$` assertion
  - on `comp_entries`: `source`, `external_ref`, `updated_at`, the partial
    unique index
  - RLS enabled with no policies on `agent_tokens`
- [x] 1.2: Add `lib/constants/agent-access.ts`: scopes, implication map, token
  prefix, expiry options, limits (10 active tokens, name length), rate limits
  (create, per-token, auth-fail), agent write quotas, body size cap, list limits,
  instructions version.
- [x] 1.3: Add `"agent"` to `WIN_SOURCES`; add `COMP_SOURCES`, `EXTERNAL_REF_MAX`
  and `EVIDENCE_URL_MAX` to `lib/constants/careerotter.ts`; add `MCP_TOOL_CALLED`
  to `CAREEROTTER_EVENT_NAMES`.
- [x] 1.4: Add shared types (`AgentTokenScope`, `AgentTokenRecord`,
  `DomainResult`, `DomainErrorKind`) to `/types/index.ts`.
- [x] 1.5: Write tests for Task 1: constants mirror the migration's CHECK lists
  (read the SQL file, like the existing career-waitlist guard); scope
  implication map is closed over the scope list.

## Task 2: Wins service and REST refactor
- [x] 2.1: Create `lib/careerotter/wins-service.ts` with `validateWinInput`,
  `createWin` (insert, detect 23505 by constraint name, return the existing row
  as `duplicate`, agent quota check), `listWins` (occurred_at range, tag, limit,
  `truncated`), `updateWin` and `deleteWin` (uuid check, `onlySource` option).
  Never throws; generic error messages; `win_logged` only on a non-duplicate
  create.
- [x] 2.2: Refactor `app/api/wins/route.ts` and `app/api/wins/[id]/route.ts`
  onto the service. Keep the response shapes (select list as a parameter) and
  all current coercions; non-uuid id → 404.
- [x] 2.3: Write tests for Task 2: service unit tests (validation, duplicate ref
  path incl. constraint-name check and vanished row, quota, onlySource,
  `user_id` filter on every query, no event on duplicate), and update
  `__tests__/api/wins.test.ts` for the uuid 404 change. Existing assertions
  otherwise unchanged.

## Task 3: Comp service, plan lookup, cached quotes and REST refactor
- [x] 3.1: Create `lib/careerotter/comp-service.ts`:
  - `validateCompInput`, moving the rules out of the POST and adding the ticker
    charset and amount maximums
  - `createCompEntry` (duplicate ref, agent quotas, 500-entry cap)
  - `updateCompEntry` (undefined keeps / null clears, merged-row validation,
    `onlySource`, sets `updated_at`)
  - `deleteCompEntry`
  - `listCompEntries` (ordered with the `created_at` tiebreak)
  - `currentCompEntry(entries, asOf)` → `{ current, upcoming }`
- [x] 3.2: Create `lib/careerotter/plan.ts` `isProUser(admin, userId)` using the
  admin client, `isEntitledStatus` and `isOnProOrHigher`.
- [x] 3.3: Add `readCachedQuotes(admin, tickers)` (select-only) to
  `lib/careerotter/stock-price-cache.ts`.
- [x] 3.4: Refactor `app/api/careerotter/comp/route.ts` and `[id]/route.ts` onto
  the service. Comp GET returns 500 when the entries query errors; non-uuid id →
  404; REST keeps `comp_entered` with `total`; the agent path sends no amount.
- [x] 3.5: Write tests for Task 3:
  - comp-service unit tests: every validation rule, merged-row cliff/vest check,
    duplicate ref, quotas and cap, onlySource, `currentCompEntry` ties and future
    entries
  - `isProUser` (Pro, Free, lapsed status, DB error)
  - `readCachedQuotes` never calls fetch or upsert
  - update `__tests__/api/careerotter-comp.test.ts` for the deliberate behavior
    changes

## Task 4: Agent token library and token API
- [x] 4.1: Create `lib/auth/agent-token.ts`:
  - `generateAgentToken` (random + CRC32 checksum)
  - `hasValidAgentTokenFormat`
  - `hashAgentToken`
  - `normalizeScopes` (dedupe, add implied reads, sort, reject unknown)
  - `verifyAgentToken` (invalid vs unavailable; revoked/expired → invalid)
  - `touchLastUsed` (5-minute throttle)
- [x] 4.2: Create `app/api/careerotter/agent-tokens/route.ts` (GET list with
  status, POST create, DELETE revoke-all) and `[id]/route.ts` (DELETE revoke
  one, idempotent). Cookie session only via `createClient().auth.getUser()`.
  Create is rate limited on the `pat-create:${userId}` key. Covers the 10-token
  limit (422), duplicate active name (409), and comp scopes forbidding "never".
- [x] 4.3: Write tests for Task 4:
  - token format and checksum round-trip; tampered checksum rejected
  - hash stability
  - `normalizeScopes` cases
  - `verifyAgentToken` returns invalid for unknown/revoked/expired and
    unavailable for a DB error
  - touch throttle
  - route tests: 401 without a session **and 401 with only a Bearer header**,
    create returns the raw token once and the list never includes hashes,
    limits, duplicate name, expiry rules, revoke idempotency, revoke-all count,
    non-uuid id → 404

## Task 5: MCP server core (route, auth, tool registry)
- [x] 5.1: Add `mcp-handler@1.1.0` and `@modelcontextprotocol/sdk@1.26.0`
  (exact pins) with pnpm. Confirm the installed `createMcpHandler`,
  `registerTool`, `outputSchema`/`structuredContent` and annotations APIs
  against the installed source before writing code.
- [x] 5.2: Create `lib/mcp/define-tool.ts`, the `defineTool` helper:
  - required scope; skips registration when the scope is missing
  - wraps `run` so it never throws
  - maps `DomainResult` errors to `isError`
  - serializes output
  - fires `mcp_tool_called` via `after()`
- [x] 5.3: Create `lib/mcp/instructions.ts` (versioned server instructions per
  PRD) and `lib/mcp/server.ts` `registerTools(server, ctx)` (initially empty
  tool modules wired in Tasks 6–7).
- [x] 5.4: Create `app/api/mcp/route.ts`:
  - 64 KB body cap (413)
  - JSON pre-parse (400 parse error)
  - bearer format/checksum pre-check (401 without `resource_metadata`)
  - per-IP auth-fail limit
  - `verifyAgentToken` (401/503)
  - per-token limit (429 + `Retry-After`)
  - `touchLastUsed`
  - per-request `createMcpHandler(..., { basePath: "/api", disableSse: true })`
  - exports POST/GET/DELETE; `runtime = "nodejs"`, `maxDuration = 30`
  - never logs the token or header
- [x] 5.5: Update `middleware.ts`: `/api/mcp` and `/api/mcp/*` in
  `isCareerotterSurface` and the matcher; early `NextResponse.next()` for these
  paths after the gate.
- [x] 5.6: Write tests for Task 5:
  - `defineTool` (scope filtering, thrown error → isError, event fired with
    `ok`/`error_kind`)
  - route tests: 413, 400, 401 variants without `resource_metadata`, 503 on DB
    error, 429, and a `tools/list` round trip through the real adapter returning
    only the scoped tools
  - middleware gate: 404 when disabled, passes through when enabled, and skips
    Supabase for `/api/mcp`

## Task 6: Wins and career tools
- [x] 6.1: Create `lib/mcp/tools/wins.ts`: `log_win`, `list_wins`, `update_win`,
  `delete_win` (agent rows only), `get_coverage`. Input schemas loose,
  service-validated; output schemas explicit.
- [x] 6.2: Create `lib/mcp/tools/career.ts`: `get_career_context` (`career:read`,
  `as_of`).
- [x] 6.3: Write tests for Task 6: each tool's happy path and error mapping,
  source `agent` on writes, duplicate flag, update/delete of a manual row →
  not_found, output parses against its outputSchema, scopes gate registration.

## Task 7: Comp tools
- [x] 7.1: Create `lib/mcp/tools/comp.ts`:
  - reads: `list_comp_entries`, `get_comp_summary` (current + upcoming,
    `price_source` quote/implied/none), `project_comp` (count semantics, bounds,
    `as_of`), `get_equity_quotes` (cached only, `missing`)
  - `get_market_benchmark` (enums, `isProUser`, `range: null` with reason)
  - `evaluate_offer` (1–2 packages, up to 5 share prices each,
    `compare_to_current`, delta, `not_modeled`)
  - writes: `add_comp_entry`, `update_comp_entry`, `delete_comp_entry` (agent
    rows only)
- [x] 7.2: Write tests for Task 7:
  - projections match `projectComp` for the same inputs
  - `as_of` pinning
  - `evaluate_offer` deltas with and without a current entry
  - non-Pro benchmark error
  - quotes never trigger fetch
  - non-finite numbers rejected
  - dates serialized as ISO strings
  - every output parses against its schema

## Task 8: Connected agents UI
- [x] 8.1: Create `components/careerotter/connected-agents.tsx` (client):
  - list with status
  - create form: scope checkboxes with implied-read behavior, expiry select that
    disables "never" when a comp scope is checked
  - show-once panel: selectable input, copy with failure fallback, `SITE_URL`
    setup snippets using `$CAREEROTTER_TOKEN`
  - revoke and revoke-all with confirm
  - 44px targets, no badges, no emojis
- [x] 8.2: Add the section and one privacy-copy line to
  `app/(app)/dashboard/data/page.tsx` (stays a server component).
- [x] 8.3: Write tests for Task 8 (Testing Library):
  - renders the list
  - checking a write checks its read
  - comp scope disables "never"
  - the token appears once after create and is cleared on dismiss
  - copy failure shows the fallback message
  - revoke-all asks for confirmation
  - snippets contain `$CAREEROTTER_TOKEN`, not the raw token

## Task 9: Recap cron pagination
- [x] 9.1: Page the recap cron's wins select with `.order("created_at")` and
  `.range()` in chunks of 1000 until a short page; behavior otherwise unchanged.
- [x] 9.2: Write tests for Task 9: more than one page of wins is fully grouped
  across users; a query error on a later page returns 500 as today.

## Task 10: Update docs made inaccurate
- [x] 10.1: `docs/agent-discovery.md`:
  - the "Not published: OAuth, auth.md, and MCP" section and the
    `/.well-known/mcp/server-card.json` bullet say "there is no MCP server";
    rewrite them to describe the token-authenticated `/api/mcp` server (dark
    behind `CAREEROTTER_ENABLED`) and why the OAuth documents are still absent
    (PATs, not OAuth)
  - the DNS-AID note that `_mcp._agents` would advertise a non-existent server:
    reword to "not until launch"
- [x] 10.2: Add launch items to `.claude/ship/phase2-LAUNCH-CHECKLIST.md`
  ("Owner-only launch steps"):
  - update `app/llms.txt/route.ts` (force-static) and
    `content/agent-skills/careerotter-public-api/SKILL.md`, which state no MCP
    server or programmatic access exists
  - real-client test (Claude Code, Cursor, MCP Inspector, including a
    2026-07-28-era client)
  - register the `co_pat_` pattern with GitHub secret scanning
  - run migration 044
- [x] 10.3: Write tests for Task 10: none needed for prose. Confirm
  `__tests__/agent-discovery/discovery-documents.test.ts` still passes, since
  the skill file is deliberately unchanged.

## Known trade-offs

- Lint gate is skipped for every task: `.eslintrc.json` exists but `eslint` is not
  a dependency, so `pnpm lint` cannot run. Type check and convention review stand in.
- Migration 044 runs in one transaction, so a failed step rolls everything back.
  `scripts/run-schema.sh` still exits 0 in that case (no `ON_ERROR_STOP`); the
  operator must read the psql output. Changing the script affects every
  migration and is left out of this change.
- Agent write quotas are soft: count-then-insert, so N concurrent writes can
  exceed a quota by up to N-1, and deleting agent rows frees their slots. Same
  for the 10-active-token limit (bounded by the create rate limit when Redis is up).
- Comp create checks the quota before looking up a retried `external_ref`
  (the lookup still runs when the quota rejects, so retries return the stored row).
  Wins looks the ref up first. Behavior is equivalent for callers.
- `loadQuotes` keeps its pre-existing `as StockPriceRow[]` cast so its behavior
  is unchanged; the new `readCachedQuotes` path uses a runtime guard.
- Revoke-all reports `db` if the returned rows have an unexpected shape even
  though the update committed; revoke is idempotent, so a retry is harmless.
- Revoking expired tokens (on name reuse and revoke-all) changes their listed
  status from "expired" to "revoked".
- Recap cron pages by offset (advancing by rows returned). A win deleted
  mid-run on a multi-page week shifts later rows, so one row can be skipped.
  Accepted: weekly, best-effort output; keyset paging is the fix if it matters.
- MCP tool calls with invalid arguments are rejected by the SDK (its own
  isError result) before the `defineTool` wrapper runs, so they are not counted
  in `mcp_tool_called`.
- The per-token MCP rate limit counts HTTP requests. JSON-RPC batches are
  rejected with 400, so this is about one unit per JSON-RPC request.
- `notifications/initialized` spends a per-token rate-limit unit like any
  other request.
- Once an IP exceeds the MCP auth-fail limit, a revoked (or otherwise invalid)
  token from that IP gets 429 instead of 401 until the window resets.
- `mcp_tool_called` for a call can be lost if the client disconnects mid-call.
- Browser clients cannot call `/api/mcp`: there is no CORS, and a foreign
  `Origin` gets 403 (DNS-rebinding protection per the MCP transport spec).
- The MCP request deadline (25 s) covers the adapter's response head. POST
  responses are SSE and stream their body after the head, so a slow tool call
  is bounded by the per-tool deadline (20 s) and Vercel's `maxDuration`.
  A tool that times out keeps running in the background; its result is dropped.
- The session-expired link carries `redirectTo=/dashboard/data`, but the login
  page doesn't read that parameter yet, so users land on the default page.
- The leave-page prompt for a revealed token fires on reload, tab close and
  external navigation, not on in-app Next.js link clicks.
- The Claude Desktop snippet necessarily puts the token in that app's config
  `env` block (mcp-remote's documented pattern); the UI tells users to keep
  that file private.
- MCP deletes report `deleted: false` for a missing row (safe retries); the REST
  delete routes still return 404, since the services are unchanged.
- MCP comp write tools accept dates from year 0001 like REST; only `as_of`
  inputs enforce the 1970 floor. Years below 100 in vest dates would project in
  the wrong century; the service does not reject them.
- A non-finite amount stored in the DB makes that row malformed, so comp read
  tools return a db error; a non-finite `shares`/`vest_years` reads as null.
- `lib/client/agent-tokens.client.ts` keeps its own `isNullableString`, because
  `domain-result.ts` imports `next/server` and can't enter the client bundle.
