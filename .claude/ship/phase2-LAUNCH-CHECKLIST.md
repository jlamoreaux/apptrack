# CareerOtter Phase 2 — Launch Go/No-Go Checklist

> **As of:** 2026-08-04T01:33:04Z · base `origin/main` @ `78f089e`
> **Snapshot — RE-RUN before launch.** PR state changes continuously; a stale
> checklist reads "ready" after it no longer is. Regenerate the table below
> (read-only `gh`) immediately before flipping anything.

## Verdict: NOT READY — but the review-feedback gate is nearly clear

1. **"All PR feedback addressed" — ⚠️ NEARLY.** 34 CodeRabbit threads were triaged
   and resolved across #183/#184/#190/#192. **4 remain, all owner-decisions** (no clear
   code fix — they need your call): #183 ×3, #192 ×1. See "Owner decisions" below.
2. **"Properly gated" — ⚠️ PARTIAL (by design).** The `careerotter-evidence` flag now
   exists in PostHog (id 797754, **disabled, 0% rollout** → evaluates false everywhere).
   It is intentionally **not yet wired** into the M2b–M5 surfaces — that happens per-PR
   as those branches merge onto M2a (wiring an unmerged branch just creates merge churn).

## PR state (snapshot)

| PR | Milestone | Mergeable | Failing checks | Unresolved threads | Ready? |
|----|-----------|-----------|----------------|--------------------|--------|
| #182 | M0 pricing | ✅ | 0 | 0 | ✅ ready |
| #183 | M1 rebrand | ✅ | 0 | **3 (owner-decision)** | ⚠️ decisions |
| #184 | M2a evidence data/API | ✅ | 0 | 0 | ✅ feedback clear |
| #185 | M2b evidence UI | ✅ | 0 | 0 | ⚠️ flag wiring at merge |
| #186 | M3 coach | ✅ | 0 | 0 | ⚠️ flag wiring at merge |
| #187 | M4 case builder | ✅ | 0 | 0 | ⚠️ flag wiring at merge |
| #188 | M5 comp tracker | ✅ | 0 | 0 | ⚠️ flag wiring at merge |
| #189 | M2c ZtC/recap/privacy | ✅ | 0 | 0 | ⚠️ flag wiring at merge |
| #190 | M6 visual identity | ✅ | 0 | 0 | ✅ feedback clear |
| #191 | M7 nav/IA | ✅ | 0 | 0 | ⚠️ flag wiring at merge |
| #192 | Launch-readiness kit | ✅ | 0 | **1 (owner-decision)** | ⚠️ decision |

## Owner decisions (block full "feedback addressed" — need your call)

- **#183 — webhook `APP_URL` precedence** (`stripe/webhook/route.ts:675`): drop the
  runtime `APP_URL` fallback repo-wide, or keep the deliberate `getAppUrl` pattern? The
  fix must be consistent app-wide, not just the webhook.
- **#183 — centralize the canonical origin** (`auth.ts` + ~11 files, heavy lift): real
  duplication with subtly different env precedence (`APP_URL` / `VERCEL_URL` / none).
  Scope this refactor or defer.
- **#183 — Zero-to-Case idempotency failure-safety** (M2a design): the marker-first
  claim is race-safe but not failure-safe (model call failing after the claim leaves a
  completed marker with no case). Pending/completed states vs transaction vs compensating
  retry — a design call.
- **#192 — banner client-side eligibility** (`rebrand-banner.tsx`): reads `created_at`
  via `useSupabaseAuth` (touches CLAUDE.md "no Supabase in client components"). Keep the
  app-wide client-auth pattern, or rework to server/API-resolved eligibility?

## Remaining path

- [ ] Owner: decide the 4 items above (I implement whatever you choose).
- [ ] Merge in ROLLOUT order; wire `careerotter-evidence` into #185–#189 + #191 entry
      points **as each merges** onto M2a (client `useFeatureFlag` / server
      `getServerFeatureFlag`, default OFF).
- [ ] Re-run this audit immediately before launch.

## Owner-only launch steps (after the above is green)

0. Run migration 044 **before the code from PR #226 deploys to any environment with
   `CAREEROTTER_ENABLED=1`**: `./scripts/run-schema.sh schemas/migrations/044_mcp_agent_access.sql`.
   The comp REST routes (not only `/api/mcp`) read and write its new columns, so
   without it `GET`/`POST /api/careerotter/comp` return 500. It runs in one
   transaction, and `run-schema.sh` exits 0 even when it rolls back, so read the
   psql output for errors rather than trusting the exit code.
1. Merge order per `phase2-ROLLOUT.md`: M0 → M2a → M2b/M3/M4/M5/M2c (flag OFF) → M6 →
   M7 → **M1 rebrand last**.
2. Domain cutover: point `careerotter.io`, set Vercel env per environment (incl.
   `NEXT_PUBLIC_APP_URL`, `REBRAND_CUTOVER_AT`), SPF/DKIM/DMARC, warm the sending domain.
3. Turn on the transition banner: set `NEXT_PUBLIC_REBRAND_BANNER=on` and
   `NEXT_PUBLIC_REBRAND_CUTOVER_AT` to the real cutover instant.
4. Send the rename email — only after domain warmup:
   - Dry-run: `POST /api/admin/rebrand-email` (returns audience counts, no send).
   - Test: `{ "testEmail": "you@..." }` (one live email to yourself).
   - Real: set `ALLOW_REAL_SEND=1` in production, then `{ "confirm": true }`.
5. Ramp `careerotter_evidence` in PostHog (10% → 50% → 100%), watching the funnels.
6. Retire the banner at cutover + 30 days (`NEXT_PUBLIC_REBRAND_BANNER=off`).
7. MCP server (`/api/mcp`) and personal access tokens — before setting
   `CAREEROTTER_ENABLED=1`:
   - Confirm migration 044 has run (step 0).
   - Update `app/llms.txt/route.ts` and `content/agent-skills/careerotter-public-api/SKILL.md`,
     which both say there is no MCP server / no programmatic access. `llms.txt` is
     `force-static`, so the change needs a redeploy; the skill's digest is published,
     so re-run `npx jest __tests__/agent-discovery` after editing it.
   - Real-client test against production: Claude Code, Cursor, MCP Inspector, Claude
     Desktop via `mcp-remote --header`, and a client on the 2026-07-28 protocol
     revision (SDK 1.26 supports up to 2025-11-25; if that client fails, the fix is
     zod 4 + `mcp-handler` 2.x).
   - Register the `co_pat_` token pattern with GitHub secret scanning.
   - Decide whether to publish `/.well-known/mcp/server-card.json` and the DNS-AID
     `_mcp._agents` record (see `docs/agent-discovery.md`).
8. MCP OAuth sign-in (`.claude/ship/mcp-oauth-PRD.md`) — after step 7, in this order,
   before and after setting `CAREEROTTER_MCP_OAUTH_ENABLED=1`:
   - **Step 0, do now:** in the Supabase dashboard, turn off the Supabase OAuth 2.1
     server and its dynamic client registration. While it's on, any signed-in user
     can mint full-power Supabase tokens for their own account. CareerOtter runs its
     own authorization server and doesn't use it.
   - Run migration 045: `./scripts/run-schema.sh schemas/migrations/045_mcp_oauth.sql`.
     It runs in one transaction, and `run-schema.sh` exits 0 even when it rolls back,
     so read the psql output for errors. It has to run before the flag is on, but
     not before the code deploys: with the flag off only revoke-all and the cleanup
     cron touch it, and both treat a missing function as a no-op.
   - Confirm Supabase's redirect allow-list accepts
     `https://careerotter.io/auth/callback?next=…` (Google sign-in and the sign-up
     confirmation link carry the consent URL in `next`). Google sign-in with `next`
     already works for the comp page, so this is a check, not a change.
   - If set, `CAREEROTTER_MCP_EXTRA_ORIGINS` must be a comma-separated list of bare
     `http(s)` origins (no path, query, credentials or `*`), such as
     `https://www.careerotter.io` only if that host serves the app rather than
     redirecting. An invalid value makes registration and `resource` validation
     throw, so new connections fail, while the 401s and metadata fall back to
     `SITE_URL` with an error log (`mcp_extra_origins_invalid`). Leave it unset if unsure.
   - Set `CAREEROTTER_MCP_OAUTH_ENABLED=1` in the Vercel **production** environment
     only (OAuth stays off on previews whatever the flag says), then redeploy.
     Check that `/.well-known/oauth-authorization-server` and
     `/.well-known/oauth-protected-resource/api/mcp` return JSON with
     `issuer` / `authorization_servers` `https://careerotter.io`, and that a POST to
     `/api/mcp` with no token returns 401 with
     `WWW-Authenticate: Bearer resource_metadata="https://careerotter.io/.well-known/oauth-protected-resource/api/mcp", scope="wins:read wins:write"`.
   - Real-client test against production with `https://careerotter.io/api/mcp`,
     confirming each one registers via dynamic registration (a new
     `agent_oauth_clients` row), completes consent, calls a tool and refreshes:
     Claude.ai custom connector, Claude Desktop, Claude Code (`/mcp`), Cursor and
     MCP Inspector. v1 has no Client ID Metadata Documents, so a client that
     requires them is a follow-up, not a launch fix. Also revoke one app on
     `/dashboard/data` and confirm its next request gets 401.
   - Verify the "Connected apps" list and revoke-all against the real database with
     the apps connected above. Both have only been tested with mocks: the list's
     history query chains three `.or()` filters on one PostgREST request and embeds
     the client's `redirect_uris` (`lib/auth/oauth/grants.ts`). Check that
     `/dashboard/data` lists each app with where it sends you back, that
     `GET /api/careerotter/agent-grants` returns without error (it returns
     `{ enabled: false }` without querying while the flag is off, so this needs the
     flag on), and that "Revoke all agent access" (`DELETE /api/careerotter/agent-tokens`)
     reports a numeric `grantsRevoked`, not `null`, and the apps' next requests get 401.
   - Register `co_oat_` (access token), `co_ort_` (refresh token) and `co_cs_`
     (client secret) with GitHub secret scanning, alongside `co_pat_`. All share
     the PAT format: prefix, 43 base64url characters, `_`, 7 base36 characters
     (`co_oat_[A-Za-z0-9_-]{43}_[0-9a-z]{7}`). Not needed: `co_client_` is a public
     identifier stored in plain text, and `co_code_` is a single-use code that
     expires after 5 minutes and is useless without the client's PKCE verifier.
   - Confirm the cleanup cron runs: `vercel.json` schedules
     `/api/cron/agent-oauth-cleanup` daily at 03:30 UTC (`30 3 * * *`). After the
     first run, check the Vercel cron log for a 200 and the
     `mcp_oauth_cleanup_complete` log line (a `mcp_oauth_cleanup_skipped` line means
     045 hasn't run). It needs `CRON_SECRET` and is gated on `CAREEROTTER_ENABLED`
     only.

## Audit method (read-only)

Per-PR `gh pr view --json mergeable,statusCheckRollup` + a GraphQL `reviewThreads`
count where `isResolved=false`. No writes, no comments, no thread resolution. Uses the
read-only `gh` account (do not `gh auth switch` for the audit).
