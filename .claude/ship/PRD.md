# PRD: Make CareerOtter Phase 2 ready to ship + address PR feedback

**Not a new feature.** Phase 2 (M0–M7) is built across PRs #182–#191. This PRD scopes the
remaining work to make that set shippable: fix the real defects reviewers (CodeRabbit) found,
correct a brand-sweep artifact, reconcile the branch/PR state, run the quality gates, and pin down
the owner-only deploy steps.

## Problem Statement
The Phase 2 PRs are mergeable but carry unresolved review findings — several are genuine bugs
(a `requirePro` that ignores subscription status, `UNLIMITED_APPLICATIONS` misclassified so Free's
unlimited tracking is described as Pro-only, forgeable win `source`, DB errors masked as 404,
double-counted `win_logged`, invalid review dates), plus a `CareerOtter.ing` brand artifact my
`AppTrack`→`CareerOtter` sweep introduced. Shipping as-is would carry a paid-access bypass, wrong
upgrade messaging, analytics noise, and off-brand marketing copy. Affected: paying users
(entitlement correctness), all users (brand/analytics), the owner (a trustworthy release).

## Goals
1. Fix every **confirmed, still-valid** CodeRabbit finding on #182, #183, #184, #190 (verify each
   against current code; skip stale/duplicate ones with a logged reason).
2. Eliminate the `CareerOtter.ing` artifact everywhere (canonical brand is `CareerOtter` /
   `careerotter.io`).
3. Land each fix on its milestone branch so the PR updates, then re-merge into the integration
   branch; keep all PRs mergeable.
4. All gates green **per touched milestone branch and on integration**: `npx tsc --noEmit`
   (error count ≤ the pinned baseline of **378** on integration; no new errors on each branch),
   `pnpm test` (all pass), `next lint` (no new errors).
5. Reply to each addressed CodeRabbit thread (fixed / skipped-with-reason).
6. Document the owner-only deploy steps in one place.

## Non-Goals
- Owner-only actions I cannot perform: creating/renaming live Stripe products/prices, DNS +
  Vercel domain + SPF/DKIM/DMARC + email warmup, applying migrations 032/033 to prod, exporting the
  CareerOtter logo PNG. These are documented, not done.
- New features. No M8. The hero Sankey→coverage visual and deeper marketing-copy work are out.
- Squashing/merging the PRs (owner decides merge order).
- Fixing pre-existing baseline `tsc` errors unrelated to this work.

## User Stories
1. As a **paying user whose subscription lapsed**, I don't retain Pro access. (Note: already true
   in production — `getSubscription()` filters to `active`/`trialing`, so a lapsed row resolves to
   Free. The `requirePro` `isActive` change is defense-in-depth, not a live-bypass fix; see
   Revision Notes.)
2. As a **Free user**, upgrade prompts never tell me unlimited *tracking* requires Pro, because
   tracking is free — only AI is gated.
3. As the **owner**, every PR reflects the reviewer fixes and I have a single deploy checklist, so I
   can merge and release with confidence.
4. As an **analyst**, `win_logged` fires once per win (server-authoritative), so activation funnels
   aren't inflated 2×.
5. As a **visitor**, marketing pages say "CareerOtter", never "CareerOtter.ing".

## Technical Approach
Fixes grouped by owning branch (fix there → push → re-merge into `careerotter/phase2-integration`):

- **M1 / #183 (`careerotter/m1-rebrand`)** — brand artifact + test fidelity:
  - `app/(marketing)/career/page.tsx`, `app/(marketing)/layoffs/page.tsx`: `CareerOtter.ing` →
    `CareerOtter`. Repo-wide grep to confirm none remain.
  - `__tests__/api/forgot-password.test.ts`: mock the real unsubscribe URL shape
    (`/api/email/unsubscribe?email=…&token=…`) or assert domain only.
- **M0 / #182 (`careerotter/m0-pricing-consolidation`)** — entitlement correctness:
  - `lib/utils/plan-helpers.ts`: exclude `UNLIMITED_APPLICATIONS` from `isAICoachFeature` **in this
    file** (the copy `getRequiredPlan`/`getUpgradeMessage` actually call — there is a second copy in
    `plans.ts`). Do **not** move the constant out of `FEATURE_ACCESS.AI_COACH_FEATURES` — it's
    referenced at `plan-helpers.ts:189` and moving it is a compile break. Latent today (no caller
    passes `UNLIMITED_APPLICATIONS` to those helpers), so this is defensive/correctness, not a live
    bug.
  - `lib/middleware/permissions.ts`: `requirePro` also requires `isActive`
    (`if (!result.isActive || !result.isPro)`). **Defensive only** — `requirePro` has no callers and
    `getSubscription()` already filters to active/trialing; the real AI gate is `hasApiPermission`
    via `checkApiPermission`, which is plan-name-based but protected by that same filter. Applying
    CodeRabbit's suggestion for hygiene; not claiming a live bypass fix.
  - `app/(app)/dashboard/upgrade/page.tsx`: select the active paid plan by **explicit name**
    (`PLAN_NAMES.AI_COACH`, the go-forward paid row), not first-non-Free `find` and not `isPro`
    (which matches both grandfathered "Pro" and "AI Coach"). Fix all three annual-savings sites
    (≈ lines 269, 339, 421): derive the savings from the plan's own prices; drop the standalone
    "2 months free" claim unless `yearly === monthly*10`.
- **M2a / #184 (`careerotter/m2a-evidence-data`)** — API robustness:
  - `zero-to-case`: reject **calendar-invalid** dates — parse Y/M/D and compare back (a bare
    `new Date("2026-02-30")` rolls over and must not be accepted). Make idempotency an **atomic
    conditional claim**: `UPDATE career_profiles SET zero_to_case_completed_at=now() WHERE user_id=?
    AND zero_to_case_completed_at IS NULL` and only spend the model call / seed wins when a row was
    affected; otherwise return the stored case. If full atomicity is deferred, log it as a known
    trade-off in TASKS.
  - `app/api/wins/route.ts`: force `source = "manual"` (ignore client `source`) on this manual
    endpoint (the capture bar sends none). Keep the single server-authoritative `win_logged`.
  - `app/api/wins/[id]/route.ts`: reject a PATCH with no editable fields (400, no `edited_at` bump);
    check the DB `error` **before** the `!data` → 404 branch so real errors return 500, not 404.
  - Analytics double-count: `win_logged` is emitted both client-side (capture bar) and
    server-side (`/api/wins`). Keep the **server** emit (authoritative, `user.id`), drop the client
    emit. Accept the identity shift (server uses the identified `user.id`). Non-manual win inserts
    (zero-to-case seed, recap) do **not** emit `win_logged` and are covered by `ztc_completed` /
    recap events — confirm and leave as-is.
  - **New migration** `schemas/migrations/034_weekly_recap_week_start_check.sql`:
    `ALTER TABLE weekly_recaps ADD CONSTRAINT ... CHECK (extract(dow from week_start)=1)`. Do **not**
    amend 032 — its `CREATE TABLE IF NOT EXISTS` would skip the CHECK on any DB where 032 already ran
    (033 exists, so 032 is applied somewhere).
- **M6 / #190 (`careerotter/m6-visual-identity`)** — contrast:
  - `app/globals.css`: check the dark warning/info/destructive **foreground-on-surface** pairs
    against WCAG AA (**4.5:1** for normal text). Adjust only the foreground tokens that fail; if all
    pass, note it and change nothing. Do not retune the whole palette.

Data flow unchanged; these are correctness/robustness fixes on existing paths.

## Edge Cases & Risks
- **Entitlement:** test `requirePro`'s predicate **directly** by mocking `getUserPlanInfo` to return
  `{ isPro: true, isActive: false }` and asserting it throws — do not route through `getSubscription`
  (which filters inactive rows out and would give a false green). Cross-user win access must 404 (add
  a denial test that mocks a row belonging to another user).
- **Idempotency (zero-to-case):** true atomicity needs a DB constraint; a marker-first claim narrows
  the window. If full atomicity is deferred, log it as a known trade-off.
- **Branch reconciliation:** editing files on milestone branches then re-merging can conflict
  (e.g., `plans.ts`, `upgrade/page.tsx` touched on multiple). Merge carefully; re-run gates on
  integration after each.
- **Migration amend:** 032 is immutable — 033 already exists, so 032 is applied in at least one
  environment, and its `CREATE TABLE IF NOT EXISTS` would silently skip a late-added CHECK anywhere
  it already ran. Any required change ships as a new migration (034), never as an amendment to 032.
- **Analytics change:** removing the client `win_logged` means the event is server-only — confirm
  the server emit covers all logging paths (capture bar posts to `/api/wins`, which emits).

## Open Questions
- Should legacy grandfathered "Pro" (cheaper, non-AI historically) get the full AI toolset under the
  one-`isPro` model? Current code says yes (any paid = isPro). Flagged for owner; not changing here.
- Weekly-recap email dispatch stays deferred until the sending domain is warmed (owner). OK.
- `past_due` gets no dunning grace anywhere (getSubscription + isEntitledStatus both exclude it).
  Instant cutoff is the current behavior; a grace window would be a separate product decision.

## Revision Notes
Adversarial critique (CodeRabbit served as the external reviewer; a critic subagent then reviewed
this PRD). Each substantive point and its resolution:
1. **`requirePro`/`isActive` framed as a live security fix, but it's dead code.** Verified:
   `requirePro` has no callers; `getSubscription()` filters to active/trialing so a lapsed row
   already resolves to Free; the real AI gate is `hasApiPermission`. Downgraded to defense-in-depth;
   User Story 1 + Goals reworded; test will assert the predicate directly (not via `getSubscription`,
   which would be a false green).
2. **Amending migration 032 is unsafe.** `CREATE TABLE IF NOT EXISTS` short-circuits, so the CHECK
   would be skipped on any DB where 032 already ran (033 exists → 032 applied somewhere). Switched to
   a new migration `034` with `ALTER TABLE ... ADD CONSTRAINT`.
3. **`UNLIMITED_APPLICATIONS` fix pointed at the wrong file and options weren't equivalent.** The
   messaging path uses `plan-helpers.ts`'s `isAICoachFeature`; moving the constant breaks
   `plan-helpers.ts:189`. Now: exclude it from `isAICoachFeature` in `plan-helpers.ts` only; keep the
   constant. Marked latent/defensive.
4. **Upgrade-page selection via `isPro` preserves the ambiguity** (matches both paid rows). Changed to
   select by explicit `PLAN_NAMES.AI_COACH`; named all three savings-claim sites.
5. **`new Date()` date validation rolls over** (`2026-02-30` → Mar 2). Spec now requires parsing Y/M/D
   and comparing back.
6. **Marker-first idempotency is still a race.** Spec now requires an atomic conditional `UPDATE …
   WHERE zero_to_case_completed_at IS NULL` gated on affected-row count; deferral must be logged.
7. **Dropping client `win_logged` shifts identity + relies on best-effort server emit.** Documented
   the identity shift as acceptable; confirmed non-manual win paths don't emit `win_logged` (covered
   by other events).
8. **Branch reconciliation under-specified.** Gates now run per touched milestone branch AND on
   integration; merge order specified in TASKS; baseline `tsc` pinned at 378.
9. **Unbounded/unfalsifiable goals.** Findings enumerated in TASKS by file:line; M6 contrast target
   pinned to AA 4.5:1 normal text with "change only failing foregrounds."
10. **Stale copy the PRD didn't touch:** `PLAN_FEATURES.PRO` still lists "Unlimited applications" as a
    Pro differentiator though tracking is free for all — added to the M0 copy cleanup.

