# PRD — CareerOtter Launch Readiness Kit

> Filename note: kept distinct from `phase2-PRD.md` / `phase2-TASKS.md` and any branch
> `PRD.md` to avoid clobbering. Covers only launch-readiness deliverables, not the
> Phase 2 feature work.

## Scale context (drives every build/buy call below)

Small user base: the Phase 0 validation email went to **95**; **3 Pro subscribers**
today; 60-day target is 10. Total accounts are in the low hundreds at most. This makes
per-device dismissal, a simple per-recipient sent-log, and a single-batch broadcast
entirely adequate — no distributed idempotency, no cross-device preference store needed.

## Problem Statement

The AppTrack → CareerOtter conversion spans 10 open PRs (M0–M7). Three launch-critical
gaps:

1. **No existing-user heads-up in-app.** M1 rebrands strings/domain/templates and 301s
   old URLs, but a logged-in user just sees the name change unexplained. The only rename
   messaging that exists is inline on 301'd roast pages (`lib/rebrand-redirect.ts`).
2. **No rename-announcement email.** `lib/email/` has broadcast infra (`sendBroadcast`,
   audiences, Resend client) but no rename template or send path. Given low DAU for a
   job-search app, **email is the primary reach channel; the banner is the secondary,
   for-when-they-return channel.** Both are needed.
3. **The product switch isn't wired.** The rollout plan depends on one
   `careerotter_evidence` flag to gate net-new surfaces (M2b–M5, M7 nav). It doesn't
   exist in `FEATURE_FLAGS` yet.

Out of scope but noted: brand strings inside Stripe receipts/billing surfaces are
owner-managed in Stripe, not in this repo.

## Goals

- G1: A dismissible, accessible, app-shell transition banner ("AppTrack is now
  CareerOtter"), shown only to existing users, only during a **fixed 30-day window**,
  with dismissal persisted (per-device) so it never nags. Emits PostHog shown/dismissed.
- G2: A rename-announcement broadcast email — branded template + owner-triggered send
  path that is **safe by construction**: dry-run default, real send requires TWO
  independent guards and refuses outside production. Honors unsubscribe; CAN-SPAM
  compliant; per-recipient sent-log prevents double-send on re-run.
- G3: The `careerotter_evidence` flag **primitive** exists (canonical key, client hook +
  one server helper, both default **false** through a single fallback). Wiring into
  M2b–M5 surfaces is explicitly **NOT** delivered here (those branches are unmerged);
  it's tracked per-PR in the rollout plan.
- G4: A launch-readiness **audit doc**, stamped with an as-of commit SHA + timestamp,
  produced **read-only** against GitHub: per-PR unresolved-thread/CI/mergeable status +
  gating status → a go/no-go checklist that must be re-run immediately before launch.

## Non-Goals (hard scope limits — load-bearing, enforced by defaults + tests, not prose)

- **NOT merging the 10 PRs.** No `gh pr merge`, no pushes to `main`.
- **NOT performing the domain/infra cutover** (DNS, Vercel env, SPF/DKIM/DMARC,
  `careerotter.io` go-live) — owner-only (M1.6).
- **NOT sending the bulk email.** Real send requires `NODE_ENV=production` AND
  `ALLOW_REAL_SEND=1` (env) AND an explicit `confirm` param — refuses if any is missing,
  and refuses entirely in CI/non-production. Dry-run is the default and the only path
  this workflow exercises.
- **NOT flipping `careerotter_evidence` (or the banner) on in any environment.** No
  committed config enables either; every environment default ships **OFF**, asserted by
  a unit test. Rollout % is set in PostHog by the owner on launch day.
- **NOT wiring the flag into M2b–M5 surfaces** (unmerged branches).
- **NOT re-doing M1's rebrand.** All three rename surfaces (roast redirect, banner,
  email) pull their headline/explainer copy from **one shared constant**
  (`lib/constants/rebrand.ts`) — no divergent wording.
- **The readiness audit is READ-ONLY against GitHub** — no thread resolution, no
  comments, no status changes. Uses the read-only `gh` account (do NOT `gh auth switch`
  to the write account for the audit).

## User Stories

- As an **existing user**, after the rename I want a clear "AppTrack is now CareerOtter —
  same account, same data, same login" banner I can dismiss, so I'm not confused.
- As a **user who dismissed the banner (on this device)**, I don't want to see it again
  here. (v1 dismissal is per-device — acceptable at this user scale; see Risks.)
- As a **user who signed up after the cutover instant**, I never see the banner.
- As the **owner**, I want to preview the email (rendered, no SMTP), see the real
  audience count, and send one live test to myself before any real send — so I can't
  blast a broken/mis-branded email during a fragile cutover.
- As the **owner**, I want a timestamped go/no-go report (threads resolved? surfaces
  gated?) so I launch on evidence.

## Technical Approach

Lands on a **dedicated branch off `main`** (`careerotter/launch-readiness`), NOT on the
M0 pricing PR.

**Shared copy source (Non-Goal enforcement):** `lib/constants/rebrand.ts` exports
the headline, sub, and "why the new name?" explainer + link. Banner, email, and (ideally)
the roast redirect import it.

**Banner (G1):**
- Component mounts in the logged-in app shell (`app/(app)/layout.tsx` — confirm this is
  the sole authed shell in Task 1; note fallback if multiple).
- Eligibility computed **server-side**: `isExistingUser = user.created_at < CUTOVER_AT`,
  where `REBRAND_CUTOVER_AT` is a **server-only** env (NOT `NEXT_PUBLIC_`). The only
  public toggle is `NEXT_PUBLIC_REBRAND_BANNER` (on/off for the 30-day window). Both must
  be true to render. Mid-cutover signups (created ≥ CUTOVER_AT) are treated as new.
- Dismissal: **localStorage** key `ff:rebrand-banner-dismissed` (per-device; matches the
  existing `ff:*` local-override convention). No migration, no per-request DB read on the
  hot path. Dismiss is optimistic and client-only; never blocks render.
- A11y acceptance: `role="status"`, close button is a real `<button>` (44px), keyboard-
  focusable, dismissible via Esc, visible focus ring, WCAG AA contrast. Banner overlays a
  reserved-height slot (no CLS) rather than pushing layout mid-paint.
- UI rules (CLAUDE.md): no emojis, no gradient text, Tailwind only.
- Emits `capturePostHogEvent("rebrand_banner_shown" | "rebrand_banner_dismissed")`.

**Rename email (G2):**
- Template `lib/email/templates/rebrand-announcement.ts`, shaped like `templates/shared.ts`
  siblings. Plain-language; imports shared copy; includes unsubscribe link + physical
  mailing address (CAN-SPAM).
- **Send from the warmed `apptrack.ing` domain**, not fresh `careerotter.io` — announcing
  a domain change from a cold domain tanks deliverability. `from`/`replyTo` read from a
  send-time constant, asserted to match the expected warmed domain or the real send refuses.
- Send path reuses `sendBroadcast` + `getSubscribedMembers(audience)` (already filters
  unsubscribes). Trigger via a guarded admin route matching the existing admin-route auth
  (confirm the exact guard in Task 2; require a test that unauthenticated/non-admin → 401/403).
- **Idempotency:** a per-recipient sent-log (small table or a marker on the existing
  broadcast/preferences store) checked before each send; a re-run after a crash skips
  already-sent addresses. Batch with basic backoff; resumable via the sent-log cursor.
- **Guards:** `dryRun` default true → renders + returns audience count + optionally one
  live test to the owner, no mass SMTP. Real send requires `NODE_ENV=production` +
  `ALLOW_REAL_SEND=1` + `confirm:true`; refuses otherwise. Emits `email_broadcast_sent`.

**Gating primitive (G3):**
- `FEATURE_FLAGS.CAREEROTTER_EVIDENCE = "careerotter-evidence"` (hyphenated value to match
  existing keys like `"dashboard-ux-audit-v1"`; PostHog flag key must be byte-identical).
  Banner window flag: `"careerotter-rebrand-banner"` if we prefer a flag over env — pick
  one in Task 3; do not define both.
- One shared resolver both the client hook and a new `lib/analytics/posthog-server.ts`
  helper call; fallback is **`false`** on `undefined`/error/no-user. Server helper takes an
  explicit distinct-id (the session user id); no user → `false`. Unit test asserts
  `undefined → false`.

**Readiness audit (G4):** `phase2-LAUNCH-CHECKLIST.md`, header = as-of SHA + timestamp +
"re-run before go/no-go." A table over #182–#191: unresolved review-thread count, CI
conclusion, mergeable state — enumerable states only, **no per-thread remediation**.
Plus gating status and owner-only launch steps. GitHub reads are read-only.

## Edge Cases & Risks (each has a test or an explicit accepted-risk)

- **Banner to new users** → server-side `created_at < CUTOVER_AT` (server-only env). TEST:
  post-cutover user → no banner.
- **Banner outlives window** → `NEXT_PUBLIC_REBRAND_BANNER` off hides it regardless of
  account age. TEST: toggle off → no banner. Teardown owner task with a due date (below).
- **Dismissal cross-device** → ACCEPTED RISK at this scale (per-device). User story
  amended to "on this device." Owner sign-off noted.
- **Dismissal write failure** → N/A (localStorage, client-only, optimistic). Never blocks render.
- **Email double-send on re-run** → per-recipient sent-log checked before send. TEST:
  re-run after partial send skips delivered addresses.
- **Real send fires by accident** → three independent guards + refuses in non-prod/CI.
  TEST: `confirm` alone without env guards → refuses; CI env → refuses.
- **Deliverability during cutover** → send from warmed `apptrack.ing`; `FROM_EMAIL`/sender
  asserted at real-send or refuse. Bounce/complaint suppression via `getSubscribedMembers`
  + owner precondition "warmup done." Documented owner precondition.
- **CAN-SPAM** → template includes unsubscribe + physical address; audience filter runs in
  the send path. TEST: template contains unsubscribe token + address.
- **Admin send route abuse** → same admin guard as existing admin routes; enforced auth
  (CSRF/same-origin via existing pattern). TEST: unauth → rejected.
- **Flag default-on leak (Vercel preview inherits env)** → defaults OFF in code; unit test
  asserts `undefined → false`; no committed env enables it. Per-environment values owner-set.
- **Flag key typo (hyphen/underscore)** → single canonical constant; PostHog key must match.
- **Server flag with no user context** → returns `false`.
- **Banner copy overflow on mobile** → constrained copy length; responsive; 44px close.
- **Audit goes stale** → stamped SHA + "re-run before launch"; read-only.

## Observability

`capturePostHogEvent` for `rebrand_banner_shown`, `rebrand_banner_dismissed`,
`email_broadcast_sent` (with recipient count, dryRun flag). Lets the owner confirm the
launch mechanisms fired.

## Teardown (nothing is permanent)

- Banner: owner sets `NEXT_PUBLIC_REBRAND_BANNER=off` at window end (**due: cutover + 30
  days**); a follow-up task removes the component + env after.
- Flag: after `careerotter_evidence` is 100% and stable, remove flag checks + dead
  branches.
- Email: irreversible once sent — the only truly one-way action; hence the triple guard.

## Test Plan (acceptance tests, one per guarantee)

1. Banner: existing user + window on → renders; new user → not; window off → not.
2. Banner: dismiss persists across reload (same device).
3. Email: dry-run sends 0 mass mail, returns correct audience count.
4. Email: real-send guards — missing any of the three → refuses; CI → refuses.
5. Email: re-run skips already-sent recipients (sent-log).
6. Email: admin route rejects unauthenticated/non-admin.
7. Flag: resolver returns `false` on undefined/error/no-user (client + server).
8. Copy: banner + email import the shared `rebrand` constant (`lib/constants/rebrand.ts`) (no literals).

## Open Questions (resolved — recorded for traceability)

- OQ1 dismissal persistence → **localStorage (per-device)**, justified by scale.
- OQ2 send trigger → **guarded admin route** matching existing admin-route auth (confirm
  exact guard in Task 2).
- OQ3 cutover timestamp → **server-only env `REBRAND_CUTOVER_AT`**; public toggle is a
  separate on/off env. Reconciles the server-side-eligibility requirement.
- OQ4 logged-out existing users → **app shell only** for v1; 301 roast copy + rebranded
  marketing serve the logged-out path. Owner may extend later. (Flagged for owner confirm.)

## Revision Notes (critic critiques → resolutions)

- **Existing-user count missing / possible over-engineering** → Added Scale Context (~95
  emailed, 3 Pro, low hundreds). Simplified: localStorage dismissal, single-batch send,
  simple sent-log — no cross-device store, no distributed idempotency.
- **Email is likely the primary channel (low DAU), banner secondary** → Stated explicitly
  in Problem #2; both retained.
- **"Bounded window" never bounded** → Fixed 30-day window + explicit off-switch env +
  teardown task with due date.
- **G3 conflates "flag exists" with "launch switch"** → Reworded: primitive only, wiring
  NOT delivered here, tracked per-PR.
- **G4 audit stale / not independent** → Stamped as-of SHA + timestamp + "re-run before
  go/no-go"; read-only against GitHub; read-only gh account.
- **Non-Goals bound actions not config** → Added: no committed config enables banner/flag
  in any env, defaults OFF asserted by test; real send needs prod + `ALLOW_REAL_SEND=1` +
  `confirm` and refuses in CI/non-prod; audit read-only (no thread writes).
- **Divergent rename copy in 3 places** → Single source `lib/constants/rebrand.ts`.
- **`NEXT_PUBLIC_` cutover timestamp leaks to client / invites client-side eligibility** →
  Cutover timestamp is server-only; only the on/off toggle is public.
- **Mid-cutover signup ambiguity** → Cutover is a single fixed instant; ≥ instant = new.
- **Dismissal data model undecided / hot-path DB read / write-failure handling** →
  localStorage resolves all three (no DB read, optimistic, never blocks).
- **A11y underspecified** → Enumerated: role=status, keyboard/Esc dismiss, focus ring,
  AA, no CLS.
- **Email idempotency hand-waved** → Per-recipient sent-log checked before send; resumable.
- **No batching/partial-failure** → Basic batch + backoff + sent-log cursor.
- **Dry-run still hits SMTP from risky domain** → Dry-run renders without mass SMTP;
  optional single live test; send from warmed apptrack.ing.
- **Admin auth unspecified / CSRF** → Matches existing admin-route guard; test unauth
  rejected; same-origin/enforced token.
- **CAN-SPAM footer** → Unsubscribe + physical address required; tested.
- **`FROM_EMAIL` unguarded at send** → Asserted to expected warmed domain or refuse.
- **Bounce/suppression** → via `getSubscribedMembers`; owner warmup precondition.
- **Announcing domain change trips spam filters** → Send from warmed domain; noted risk.
- **Flag default-off split across two systems** → Single resolver, fallback false, unit
  tested; server helper needs explicit distinct-id, no-user → false.
- **Flag key hyphen/underscore inconsistency** → Canonical hyphenated value, one constant.
- **Audit scope creep / gh account gotcha** → Table of enumerable states only; read-only
  account; no writes.
- **Risks defer their own mitigations** → Each risk now maps to a test or an explicit
  accepted-risk with sign-off.
- **Env vars leaking to preview** → Added risk + default-off test.
- **No rollback/teardown** → Teardown section added.
- **No test plan** → Test Plan section added.
- **No observability** → Observability section added.
- **OQ1/OQ2 consequential, left open** → Resolved in Open Questions above.
