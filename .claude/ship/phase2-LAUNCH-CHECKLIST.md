# CareerOtter Phase 2 — Launch Go/No-Go Checklist

> **As of:** 2026-08-03T22:39:20Z · base `origin/main` @ `78f089e`
> **Snapshot — RE-RUN before launch.** PR state changes continuously; a stale
> checklist reads "ready" after it no longer is. Regenerate the table below
> (read-only `gh`) immediately before flipping anything.

## Verdict: NOT READY TO SHIP

Two gate conditions from the ship request:

1. **"All PR feedback addressed" — ❌ FALSE.** 20 unresolved review threads remain
   across 3 PRs (#183: 15, #184: 4, #190: 1). Must be resolved or explicitly waived.
2. **"Properly gated" — ⚠️ PARTIAL.** The `careerotter_evidence` flag primitive now
   exists and defaults OFF, but it is **not yet wired** into the M2b–M5 surfaces
   (those branches are unmerged). Wiring happens per-PR at merge. Until then, flipping
   the flag does nothing — there is no working switch yet.

## PR state (snapshot)

| PR | Milestone | Mergeable | Failing checks | Unresolved threads | Ready? |
|----|-----------|-----------|----------------|--------------------|--------|
| #182 | M0 pricing | ✅ | 0 | 0 | ✅ ready |
| #183 | M1 rebrand | ✅ | 0 | **15** | ❌ feedback |
| #184 | M2a evidence data/API | ✅ | 0 | **4** | ❌ feedback |
| #185 | M2b evidence UI | ✅ | 0 | 0 | ⚠️ needs flag wiring |
| #186 | M3 coach | ✅ | 0 | 0 | ⚠️ needs flag wiring |
| #187 | M4 case builder | ✅ | 0 | 0 | ⚠️ needs flag wiring |
| #188 | M5 comp tracker | ✅ | 0 | 0 | ⚠️ needs flag wiring |
| #189 | M2c ZtC/recap/privacy | ✅ | 0 | 0 | ⚠️ needs flag wiring |
| #190 | M6 visual identity | ✅ | 0 | **1** | ❌ feedback |
| #191 | M7 nav/IA | ✅ | 0 | 0 | ⚠️ needs flag wiring |

## Blocking work before launch

- [ ] Resolve the 15 unresolved threads on **#183 (M1 rebrand)** — the highest-risk PR
      (domain, strings, emails, 301s).
- [ ] Resolve the 4 unresolved threads on **#184 (M2a)**.
- [ ] Resolve the 1 unresolved thread on **#190 (M6)**.
- [ ] Wire `careerotter_evidence` into the entry points of #185–#189 and the #191 nav as
      each merges (client `useFeatureFlag` / server `getServerFeatureFlag`, default OFF).
- [ ] Re-run this audit; confirm all three feedback PRs show 0 unresolved.

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
