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

## Audit method (read-only)

Per-PR `gh pr view --json mergeable,statusCheckRollup` + a GraphQL `reviewThreads`
count where `isResolved=false`. No writes, no comments, no thread resolution. Uses the
read-only `gh` account (do not `gh auth switch` for the audit).
