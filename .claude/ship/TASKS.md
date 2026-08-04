# Task Breakdown: Make CareerOtter Phase 2 ready to ship + address PR feedback

Each fix lands on the branch that **owns the file** (push → the PR updates), then all fix commits are
re-merged into `careerotter/phase2-integration`. Verify against current code first; skip stale
findings with a logged reason. Gates run per touched branch AND on integration (tsc ≤ 378 baseline,
`pnpm test` green, `next lint` no new errors).

## Task 1: M1 brand artifact + test fidelity (branch `careerotter/m1-rebrand`, PR #183)
- [ ] 1.1: Replace `CareerOtter.ing` → `CareerOtter` in `app/(marketing)/career/page.tsx` (2×) and
  `app/(marketing)/layoffs/page.tsx` (4×). Repo-wide grep to confirm zero `CareerOtter.ing` /
  `careerotter.ing` remain.
- [ ] 1.2: `__tests__/api/forgot-password.test.ts` — mock the real unsubscribe URL shape
  (`/api/email/unsubscribe?email=…&token=…`) or assert domain-only (skip if the assertion is already
  domain-scoped — verify first).
- [ ] 1.3: Tests for Task 1 (the forgot-password mock IS the test; add a brand-string assertion only
  if one already exists to extend).

## Task 2: M0 entitlement correctness (branch `careerotter/m0-pricing-consolidation`, PR #182)
- [ ] 2.1: `lib/utils/plan-helpers.ts` — exclude `UNLIMITED_APPLICATIONS` from `isAICoachFeature`
  (this file's copy). Do NOT move the constant (breaks `plan-helpers.ts:189`).
- [ ] 2.2: `lib/middleware/permissions.ts` — `requirePro`: `if (!result.isActive || !result.isPro)`
  (defense-in-depth; keep the `requireAICoach` alias).
- [ ] 2.3: `app/(app)/dashboard/upgrade/page.tsx` — select the paid plan by explicit
  `PLAN_NAMES.AI_COACH` (not first-non-Free / not `isPro`). Fix the three savings-claim sites
  (≈269/339/421): derive from the plan's own prices; drop the bare "2 months free" unless
  `yearly === monthly*10`.
- [ ] 2.4: `lib/constants/plans.ts` — `PLAN_FEATURES.PRO` no longer lists "Unlimited applications" as
  a Pro-only differentiator (tracking is free for all).
- [ ] 2.5: Tests — `isAICoachFeature("UNLIMITED_APPLICATIONS") === false` and
  `getRequiredPlan`/`getUpgradeMessage` for it don't say Pro; `requirePro` throws when
  `getUserPlanInfo` is mocked `{isPro:true, isActive:false}` (assert predicate directly).

## Task 3: M2a API robustness + migration (branch `careerotter/m2a-evidence-data`, PR #184)
- [ ] 3.1: `app/api/careerotter/zero-to-case/route.ts` — real calendar-date validation (parse Y/M/D,
  compare back; reject `2026-02-30`). Idempotency via atomic conditional claim: `UPDATE
  career_profiles SET zero_to_case_completed_at=now() WHERE user_id=? AND
  zero_to_case_completed_at IS NULL`; only call the model + seed wins when a row was affected, else
  return the stored case. (If deferring atomicity, log as a trade-off here.)
- [ ] 3.2: `app/api/wins/route.ts` — force `source = "manual"` (ignore client `source`).
- [ ] 3.3: `app/api/wins/[id]/route.ts` — PATCH with no editable fields → 400 (no `edited_at` bump);
  handle DB `error` before the `!data` → 404 so real errors return 500.
- [ ] 3.4: New migration `schemas/migrations/034_weekly_recap_week_start_check.sql`:
  `ALTER TABLE weekly_recaps ADD CONSTRAINT weekly_recaps_week_start_monday CHECK
  (extract(dow from week_start) = 1)`. (Do NOT amend 032.)
- [ ] 3.5: Tests — invalid-date 400 (incl. `2026-02-30`); forged `source` coerced to `manual`;
  empty PATCH → 400; DB-error → 500 (not 404); cross-user PATCH/DELETE → 404 (denial test).

## Task 4: M2b analytics dedup (branch `careerotter/m2b-evidence-ui`, PR #185)
- [ ] 4.1: `components/careerotter/win-capture-bar.tsx` — remove the client `trackWinLogged` emit
  (server `/api/wins` is authoritative). Leave the helper export (harmless) or remove if it becomes
  unused-and-lint-flagged.
- [ ] 4.2: Update `__tests__/components/win-capture-bar.test.tsx` — drop the assertion that the client
  event fires; keep the POST-contract + success/error assertions.

## Task 5: M6 contrast check (branch `careerotter/m6-visual-identity`, PR #190)
- [ ] 5.1: `app/globals.css` — compute WCAG contrast for dark warning/info/destructive
  foreground-on-surface pairs; adjust only foregrounds that fail AA (4.5:1 normal text). If all pass,
  note it and change nothing.
- [ ] 5.2: No test (visual/token); record the measured ratios in the commit message.

## Task 6: Docs sweep
- [ ] 6.1: `.claude/ship/TASKS.md` / `.claude/ship/PRD.md` — reflect CodeRabbit's doc findings: the
  `isPro(plan-name)` contract (canceled/trialing behavior), and a Free-user Zero-to-Case acceptance
  line (starter case is free once for everyone). Only fix inaccuracies; no new docs.
  (No README/CLAUDE.md/.env.example changes — these fixes add no conventions or env vars.)

## Task 7: Reconcile + verify + reply
- [ ] 7.1: Re-merge fix commits into `careerotter/phase2-integration` in order: m0 → m1 → m2a → m2b
  → m6. Resolve any conflicts (watch `plans.ts`, `upgrade/page.tsx`); re-run gates after each.
- [ ] 7.2: Run the gates (`npx tsc --noEmit` (≤378), `pnpm test`, `next lint`) on **every touched
  milestone branch** (m0, m1, m2a, m2b, m6) as well as on `careerotter/phase2-integration`, so
  branch-specific TypeScript/test/lint failures surface before merge, not after.
- [ ] 7.3: Reply to each addressed CodeRabbit thread on #182/#183/#184/#190 (fixed / skipped-with-
  reason), and post a short "addressed" summary comment per PR.
- [ ] 7.4: Maintain the owner deploy checklist (Stripe M0, DNS/email M1, apply migrations
  032/033/034, logo PNG, enable recap email) in **one canonical location** (this file, `## Owner
  deploy checklist`); link to it from anywhere else it's referenced (e.g. a PR comment) rather than
  duplicating the steps, to prevent drift. (Owner-only; documented.)

## Known trade-offs (to confirm/log during implementation)
- If zero-to-case atomicity can't be made a single conditional UPDATE cleanly, the residual
  double-submit race is logged here (narrowed, not eliminated).
- Owner-only actions (live Stripe, DNS/email, prod migrations, logo asset) are documented, not done.
