# PRD: Career Companion Phase 0 (Demand Validation) + Phase 1 (Roast Funnel Fix)

**Source of truth:** the owner's "Career Companion Phase 0" PRD — an **external document held by the owner** (not checked into this repo); request a copy from the owner if you need it. This document translates it into a concrete build plan grounded in the actual codebase. **Phase 2 (coaching loop prototype) is explicitly out of scope — gated on Phase 0 results + owner approval.**

**Stack (confirmed from repo):** Next.js 15 App Router · Supabase/Postgres · Resend · PostHog (`posthog-js` client / `posthog-node` server; project **AppTrack.ing id 55190** — the MCP default project 473787 is a different project; all insight work targets 55190) · Upstash Redis rate limiting (`lib/services/rate-limit.service.ts`) · Jest · `npx tsc --noEmit` · `next lint`.

**Known baseline defect:** the repo currently **fails `npx tsc --noEmit`** with pre-existing errors (shipped because `next.config` sets `typescript.ignoreBuildErrors: true`). Three of those errors are roast-route bugs this plan fixes (see Phase 1); the rest (a test file, an unrelated route-export issue) are out of scope. The type-check quality gate for this work is therefore: **no new errors vs. the recorded baseline, and the three roast errors eliminated.**

---

## Problem Statement

AppTrack has an activation problem and a structural churn flaw: users who get hired leave. The strategic hypothesis — expanding into a career companion for employed professionals ("get promoted faster") — must be validated with the existing user base at near-zero cost before anything is built. Separately, the resume roast flow (AppTrack's best acquisition surface) has a P0 funnel drop-off, now measured for the first time (see `.claude/ship/roast-funnel-analysis.md`): **71.4% of result-page viewers never click signup**, and server-side error telemetry has never fired due to a scope bug in the API's catch blocks.

Who is affected: the owner (needs a data-backed go/no-go decision), existing users (get one validation email + an in-app pointer), and roast users (broken error responses, dead-end results page).

Why now: gate decisions for the career-companion direction are blocked on Phase 0 data; the roast fix is a standing P0.

## Goals

1. Ship a validation email + waitlist landing page + in-app banner within days, instrumented so the Phase 0 gate (≥5% of emails resulting in a join OR ≥25 joins, AND ≥40% of joiners reporting a review within 6 months) is answerable from **one PostHog dashboard** backed by the `career_waitlist` table as ground truth.
2. Distinguish email vs. in-app vs. direct conversion (`source` on every join).
3. Fix the measured roast P0: repair the results-page conversion path, eliminate the catch-block bugs blacking out error telemetry, and make signups roast-attributable; ship a before/after comparison insight.
4. Zero disruption: no existing functionality gated, existing unsubscribe/suppression contracts respected, no Stripe changes, no new infra.

## Non-Goals

- Phase 2 (win logging, gap analysis, review-prep export) — gated; not built here.
- Full career-platform features, job aggregation, market-data seam tools, llms-txt grader — parked per owner PRD.
- Pricing changes, native mobile, drip sequences for the waitlist (one email only).
- **Roast funnel-shape changes** (e.g., deferring the email-before-upload requirement — the secondary 50% landing→upload drop). Product change requiring owner sign-off; recommended as a follow-up experiment, not shipped here.
- Bounce/delivery webhooks. We measure **sent** (Resend acceptance), not delivered (see Open Questions).
- Fixing pre-existing type errors unrelated to this feature.

## User Stories

1. As an **existing AppTrack user**, I receive one email asking if I'm up for a raise/promotion in the next 6–12 months, and can join a waitlist in under 30 seconds (email pre-filled if logged in), so I can express interest without commitment.
2. As a **logged-in user**, I see a dismissible dashboard card pointing to the waitlist page; once dismissed it stays dismissed on that device, so my workflow isn't disrupted.
3. As the **owner**, I open one PostHog dashboard ("Career Companion Phase 0 Gate") and can answer both gate criteria without ad-hoc queries.
4. As the **owner**, I trigger the validation email myself (after approving copy) with a dry-run and a test-send first, and a double-trigger cannot double-send the list.
5. As a **roast user**, when my roast fails I get the intended error message (not a generic network failure), and the team can see why I dropped off.
6. As a **roast user viewing my results**, I see a clear reason and path to sign up, so the results page is a beginning rather than a dead end.

## Technical Approach

### Phase 0 — Deliverable 1: Validation email

- **Template**: new `lib/email/templates/career-validation.ts` composed with `wrapEmail`/`ctaButton` from `lib/email/templates/shared.ts` (modeled on `changelog.ts`). Copy per owner PRD §3.1: core question ("Are you up for a raise or promotion in the next 6–12 months?"), 2–3 sentence companion intro, single CTA → waitlist page. Copy is **draft**; owner approves final copy before send (Open Question 3). CTA URL built from `process.env.NEXT_PUBLIC_APP_URL` (the `shared.ts` convention — never hardcode the domain): `${APP_URL}/career?utm_source=email&utm_medium=email&utm_campaign=career_companion_validation`.
- **Send mechanism**: `sendBroadcast` (`lib/email/broadcast.ts`) already enumerates `audience_members` with `subscribed = true` (the existing suppression contract) and builds per-recipient global unsubscribe URLs. **Required modification**: `getSubscribedMembers` selects only `email, first_name` and `sendBroadcast` returns only aggregate counts — extend the query to include `user_id` and extend the return to include per-batch recipient lists `{ email, userId }[]` for successful batches (`resend.batch.send` succeeds/fails per batch of 100, so success granularity is per batch — acknowledged).
- **Trigger route** `app/api/admin/career-validation-email/route.ts`, modeled on `app/api/cron/weekly-changelog/route.ts` but with two deliberate differences: auth via the timing-safe `verifyCronAuth` (`lib/email/lifecycle-cron.ts`) — *not* the model route's naive string compare — and `export const maxDuration = 300`. POST body: `{ dryRun?: boolean, testEmail?: string, audiences?: AudienceId[], force?: boolean }`. Dry-run returns per-audience recipient counts and sends nothing. Reusing `CRON_SECRET` for an owner-triggered admin route conflates cron and admin identity — accepted trade-off for a single-operator project; the route lives under `/api/admin/` to mark intent.
- **Idempotency**: the migration (below) also creates `campaign_sends (campaign text primary key, sent_at timestamptz, recipient_count int, metadata jsonb)`. The route **inserts the marker row first** (the primary-key constraint atomically rejects a concurrent second trigger), then sends. If the send throws, the marker remains and a re-send requires `force: true` — fail-closed by design: the owner inspects Resend before forcing, because a partial batch failure means "some sent," and re-sending everyone is worse than manually finishing. `dryRun` and `testEmail` skip the marker entirely.
- **`FROM_EMAIL` guard**: `sendBroadcast` silently falls back to `onboarding@resend.dev` (a test address). The route asserts `FROM_EMAIL` is set and passes it explicitly as `from` before any send path (including `testEmail`), returning 500 with a clear message otherwise.
- **Audiences**: default `['free-users', 'trial-users', 'paid-users']` (signed-up users). `leads` excluded by default — owner PRD targets "the existing AppTrack user list"; the `audiences` param lets the owner widen it (Open Question 1). Coverage caveat: users absent from `audience_members` are unreachable; dry-run reports counts so the owner can compare against `profiles` and run `scripts/backfill-resend-audiences.mjs` first if needed.
- **Analytics**: after each successful batch, fire `career_email_sent` per recipient with `{ campaign: 'career_companion_validation' }`. Distinct id: `user_id` when present, else a **SHA-256 hash of the email** (`audience_members.user_id` is nullable) — hashed so PostHog never stores a raw email as an identifier, while staying deterministic per recipient for counting. The insight reads counts, not identity joins. To avoid one HTTP request per event (`posthog-server.ts` uses `flushAt: 1`), the send route constructs a **local batched `PostHog` client** (`flushAt: 100`) and awaits `shutdown()` before responding. Send count is also persisted on the `campaign_sends` row — the durable denominator for the gate.

### Phase 0 — Deliverable 2: Waitlist landing page `/career`

- **Route**: `app/(marketing)/career/page.tsx` — no route collision (verified); public by default (middleware only guards `/dashboard*`); server component fetching `getUser()` to pass `userEmail`/`userId` props for pre-fill. Route name `/career` is the default (Open Question 2).
- **Content**: headline "Get promoted faster." + one-paragraph honest pitch ("we're building this, want in?" framing — no fake pricing/features), styled with existing marketing primitives (`ButtonLink`, semantic Tailwind tokens, `py-16`, `max-w-6xl`, no emojis/gradient text per CLAUDE.md).
- **Form**: client component modeled on `components/try/email-capture-gate.tsx`'s fetch pattern — email input (pre-filled when logged in) + required dropdown "When is your next performance review?" (`<3 months / 3–6 months / 6–12 months / no formal reviews / not sure`), one step, one submit. (Owner wording "one qualifying question on submit" — implemented as same-form; the friction trade-off vs. a two-step capture is Open Question 6.) **Error UX specified**: invalid email → inline message; 429 → "Too many attempts — try again in an hour"; network/server failure → inline retryable error; success → confirmation state. No silent failures.
- **Storage**: new migration `schemas/migrations/031_career_waitlist.sql` (031 — migrations currently end at 030): `career_waitlist (id uuid pk default gen_random_uuid(), email text unique not null, user_id uuid null references profiles(id), review_timing text not null check (...), source text not null check (source in ('email','banner','direct')), utm jsonb, created_at timestamptz default now())` plus the `campaign_sends` table (Deliverable 1). RLS: service-role only, API-route access exclusively (CLAUDE.md rule 4). Dedicated table (not `audience_members.metadata`) because Phase 2 cohort selection filters on `review_timing` and gate counts must be independent of marketing-list state.
- **Write semantics — append-only, first join wins**: `INSERT ... ON CONFLICT (email) DO NOTHING`. Re-joins return success to the user (idempotent UX) but never mutate the existing row — a public endpoint with upsert would let anonymous traffic overwrite the `review_timing` data the gate is computed from. `user_id` comes **only** from the server session (never the payload), and only on insert. `career_waitlist_joined` fires only when a row was actually inserted, so events ≈ distinct joins.
- **API**: `POST /api/career-waitlist` with `{ email, review_timing, source?, utm?, ph_distinct_id? }`. Server-side: normalize email (`trim().toLowerCase()`), validate format + disposable-domain block via the existing `lib/email/validate.ts` (junk emails would pollute the gate; trade-off noted), validate `review_timing` against the enum (400 on mismatch — never let a CHECK constraint 500), coerce `source` to the enum (unknown → `'direct'`), whitelist `utm` to the five standard keys at ≤200 chars each, rate limit by IP via `lib/services/rate-limit.service.ts` (Upstash — **not** the in-memory Map in `capture-email`, which resets per serverless instance), resolve `user_id` from session, insert via service-role client. **No drip scheduling** (Phase 0 constraint: one email, no drip).

### Phase 0 — Deliverable 3: PostHog instrumentation & gate measurement

- New `lib/analytics/career-events.ts` mirroring `lib/analytics/campaign-events.ts` (private capture helper merging `...getStoredUTMParams()`, typed track functions). Events:
  - `career_email_sent` — server, per recipient at send time (Deliverable 1).
  - `career_email_clicked` — client, fired once per session on `/career` mount when `utm_campaign=career_companion_validation` (sessionStorage de-dupe). **Honest definition: "landed from the email"** — there is no independent click signal without Resend click-tracking (Open Question 7); this event is deliberately *not* placed as a funnel step between sent and viewed.
  - `career_waitlist_viewed` — client, on `/career` mount, `source` derived from UTM/query. Directional only (public page; bots and link-prefetch proxies inflate it).
  - `career_waitlist_joined` — **server-side in the API route. Distinct id: session `user_id` (trusted) → client-forwarded `ph_distinct_id` → SHA-256 hash of the email.** The session id wins so an authenticated join can't be mis-attributed by a spoofed `ph_distinct_id`; the client value is used only for anonymous joins, where it stitches to the same browser session as `viewed`; the email is hashed so PostHog never stores it raw. Ad-blocker-resistant. Properties: `review_timing`, `source`, whitelisted UTMs (client-forwarded, therefore spoofable — acceptable; the DB is ground truth).
  - `career_banner_clicked` / `career_banner_dismissed` — client, from the dashboard banner.
- **Gate measurement design** (a single strict 4-step person funnel cannot stitch server-uuid → anonymous-browser → server events; it would systematically undercount and could show a false "fail"):
  - Dashboard **"Career Companion Phase 0 Gate"** in project 55190 containing:
    1. Trends: `career_email_sent`, `career_email_clicked`, `career_waitlist_viewed`, `career_waitlist_joined` (unique persons) + formula **join rate = joined(source=email) / sent** — the ≥5%/≥25 gate, read as a ratio of counts, not an identity-stitched funnel.
    2. Funnel: `career_waitlist_viewed → career_waitlist_joined` (stitches correctly per browser via `ph_distinct_id`), broken down by `source` — email vs banner vs direct page conversion.
    3. Trends: `career_waitlist_joined` breakdown by `review_timing` — the ≥40%-within-6-months gate.
  - Insight descriptions carry the gate thresholds. `SELECT count(*) FROM career_waitlist` remains the authoritative join count; the `campaign_sends.recipient_count` row is the authoritative denominator.

### Phase 0 — Deliverable 4: In-app banner

- `components/career-waitlist-banner.tsx` modeled on `components/hired-subscription-banner.tsx`: client Card, localStorage dismissal key `career-waitlist-banner-dismissed:${userId}` (per-device — accepted, matches existing pattern), X button, CTA → `/career?utm_source=in_app&utm_medium=banner&utm_campaign=career_companion_validation`. Fires `career_banner_clicked` / `career_banner_dismissed`.
- **Placement & stacking**: rendered in `app/(app)/dashboard/page.tsx` *after* the existing `SubscriptionUsageBannerServer` and `HiredSubscriptionBanner`, and **suppressed when the hired banner is showing** (the dashboard already computes `showHiredBanner`-equivalent props; pass a boolean) — max one promotional banner at a time.
- **"Active users"**: rendering only on the dashboard *is* the activity filter (only returning users see it) — deviation from a stricter activity criterion acknowledged; no extra activity computation for a validation phase.
- **Copy**: neutral, does not pre-answer owner Open Question §8.5 (separate mode vs integrated) — e.g., "Planning your next raise or promotion? We're building something for that." + CTA "Join the waitlist".

### Phase 1 — Roast funnel P0 fix

Baseline analysis: `.claude/ship/roast-funnel-analysis.md` (first-ever saved analysis; no prior art existed in PostHog or the repo). Measured P0: **`roast_viewed` → `roast_signup_clicked` = 28.6% step conversion** (14 → 4 persons / 90 days). Upload pipeline converts 100% step-over-step; post-click signup converts 75%. Traffic is tiny (28 landing visitors / 90 days) — flagged in the delta-report caveat.

1. **Telemetry & correctness fix (all three same-class bugs)**:
   - `app/api/roast/route.ts:429` — `user` referenced in `catch` but declared inside `try`: every roast failure throws `ReferenceError`, killing both the `api_error` capture (which has *never* fired in PostHog) and the intended JSON error response. Hoist the declaration; error path returns the designed error shape.
   - `app/api/roast/route.ts:106` — `user.id` on type `never`, same root cause.
   - `app/api/roast/[id]/route.ts:91` — `id` referenced in `catch` out of scope: results-fetch failures (a later step of this same funnel) crash the error handler. Same fix.
   - Tests: route-level unit tests (existing `__tests__/api` pattern) asserting the error path returns the designed JSON error shape and status. (Asserting the `api_error` capture *inside* Next's `after()` is harness-heavy; the capture call is covered by mocking the analytics module, not by asserting `after` semantics.)
2. **Results-page conversion repair (the measured P0)**: restructure the signup CTA on `roast-display.tsx` (v1 + v2 variants) from a dead-end footer button into a value-forward conversion module: state what signup gets the user (save this roast, track applications, targeted improvement tips), place the primary CTA directly after the score/summary, keep a second CTA at page end. No funnel-shape change, no new steps, no gating. Keeps existing `roast_signup_clicked` event (add `placement` property to distinguish CTA positions).
3. **Attribution (zero new plumbing)**: `user_signed_up` (`app/auth/callback/route.ts:72`) already carries UTM attribution via the `apptrack_utm` cookie. Add UTM params to the results-page signup CTA links (`utm_source=roast&utm_medium=results_page&utm_campaign=roast_funnel`) — roast-attributed signups become queryable with the existing mechanism. (The earlier `?roast_id=` pass-through idea is dropped: it would have to survive the OAuth/email-confirm round trip for no additional gate value.)
4. **Instrumentation gap**: add `roast_file_selected` (client, on file pick) so landing-form abandonment is visible; register `roast_try_another` in the `ROAST_EVENTS` constants (currently a raw string).
5. **Before/after insight**: saved funnel `$pageview (/roast-my-resume) → roast_upload_started → roast_upload_completed → roast_viewed → roast_signup_clicked → user_signed_up` in project 55190 (landing step pinned to the live `/roast-my-resume` path — the v2 page has no traffic and no experiment routes to it), duplicated as pre-fix (fixed date range ending at ship date) and post-fix (rolling from ship date) — PostHog cannot cleanly date-split one funnel insight, so two insights + an annotation at ship time. **Delta report**: agent prepares the report template + insights now; the owner (or a follow-up agent run) fills numbers after 2 weeks. Caveat documented: at current traffic (~0–1 uploads/week), 2 weeks is directionally suggestive at best, and roast *traffic* is the bigger lever.

### Data flow summary

Email (Resend broadcast, owner-triggered, idempotent) → `/career?utm…` → client events + `POST /api/career-waitlist` (append-only) → `career_waitlist` table + server `career_waitlist_joined` (session-stitched) → gate dashboard → owner decision. Banner and direct visits enter the same page with different `source`.

## Edge Cases & Risks

- **Double-send**: primary-key marker inserted before send; concurrent triggers race on the constraint; partial failure requires explicit `force: true` after manual inspection.
- **Unsubscribed users**: `sendBroadcast` filters `subscribed = false`; unsubscribe link in every footer via `wrapEmail`. No new consent surface.
- **Waitlist data integrity**: append-only inserts; `review_timing` immutable after first join; `user_id` from session only; a logged-in user submitting someone else's email creates a row with their `user_id` attached only if that email is new — accepted residual risk, no overwrite of existing rows.
- **Abuse**: Upstash IP rate limit; format + disposable-domain validation; junk rows add noise but cannot mutate signal; DB count is ground truth.
- **Ad-blockers**: decision-critical join event is server-side; `viewed`/`clicked` directional.
- **Bots on the public page**: inflate `viewed` only; gate reads `joined`.
- **Send-route runtime**: `maxDuration = 300`, batched PostHog client, Resend batching at 100/call. Dry-run reports list size before any real send (Open Question 1).
- **Sent ≠ delivered**: gate denominator is Resend-accepted sends; bounces shrink the true denominator, making the measured rate *conservative* — noted for the owner's gate reading (Open Question 7).
- **Roast fix regression**: touches the error path of the roast API — covered by route tests for the error-response shape; the CTA restructure keeps event names stable so the before/after funnel stays comparable.
- **PII**: waitlist stores email + review timing only; events carry `review_timing` + UTMs. Emails are never sent to PostHog as a raw distinct id — when no `user_id` is available the distinct id is a SHA-256 hash of the email.

## Open Questions (owner — none block the build; 1, 3, 4 block the *send*)

1. **List size / audiences**: confirm audiences (default free + trial + paid, excluding `leads`); dry-run will report exact counts. If counts look low vs. `profiles`, run `scripts/backfill-resend-audiences.mjs` first.
2. **Route name**: `/career` assumed (vs `/companion`); page is public/shareable by default.
3. **Final email copy**: draft ships in the template; owner edits/approves before triggering the send.
4. **Gate thresholds**: §3.2 defaults encoded in the dashboard insight descriptions; confirm before send. Note the denominator is *sent* (Resend-accepted), not *delivered* — conservative bias.
5. **Phase 2 price point** (owner PRD §8.4): $15/mo assumed — confirm before Phase 2. No Phase 0 code impact; carried here so it isn't lost.
6. **Qualifying question placement**: required dropdown on the join form (default) vs. two-step post-email capture. Default maximizes `review_timing` coverage (the 40% sub-gate) at some cost to raw join rate (the 5% gate). Owner call.
7. **Email click tracking**: `career_email_clicked` = "landed on the page from the email." If a true click signal is wanted, enable Resend click-tracking on the broadcast — otherwise accepted as-is.
8. **Positioning** (§8.5, separate mode vs integrated): does not affect Phase 0 code; banner copy stays neutral.

## Revision Notes

Critique from the adversarial review, and how each was resolved:

1. **Migration number wrong (041 vs actual next 031)** — verified `schemas/migrations/` ends at `030`; corrected to `031_career_waitlist.sql`. (The "040" figure came from conflating `scripts/*.sql` with migrations.)
2. **"Upstash" rate-limit pattern actually an in-memory Map** — verified; now cites `lib/services/rate-limit.service.ts` (real Upstash) and explicitly warns off the `capture-email` Map.
3. **Repo fails `tsc` today; gate unrunnable as stated** — verified (pre-existing errors incl. three roast bugs; `ignoreBuildErrors: true`). Gate redefined as no-new-errors vs. baseline + the three roast errors fixed.
4. **Sibling roast bug missed (`[id]/route.ts:91`)** — verified and added to Phase 1 fix 1; also `route.ts:106`.
5. **`roast-funnel-analysis.md` didn't exist** — now written with live PostHog data; Phase 1 fix selection is pinned to the measured drop-off (results page, 71.4% step loss), removing the "unilateral funnel redesign" decision rule.
6. **Fix candidate 3 was scope creep (funnel-shape change)** — moved to Non-Goals; recommended as owner-approved follow-up experiment. Moot as the *fix* anyway: the measured P0 is the results page, not the upload form.
7. **Signup attribution over-engineered (`?roast_id=` round trip) / existing UTM cookie ignored** — verified `user_signed_up` already carries UTMs; switched to UTM params on CTA links; roast_id pass-through dropped with rationale.
8. **Which roast page is live unpinned** — resolved with PostHog data: `/roast-my-resume` has all traffic; no v2 experiment/flag exists. Funnel landing step pinned.
9. **Funnel identity stitching broken by design (server uuid → anon client → server)** — redesigned: gate read as ratio-of-counts insights + a viewed→joined funnel stitched via client-forwarded `ph_distinct_id` on the join API; single-dashboard user story preserved honestly; DB stays ground truth.
10. **`career_email_clicked` ≡ `viewed` (decorative funnel step)** — event kept with an honest definition ("landed from email"), removed from any funnel step sequence; Resend click-tracking offered as Open Question 7.
11. **Upsert = unauthenticated overwrite of gate data** — switched to append-only `ON CONFLICT DO NOTHING`, first join wins, `user_id` from session only, `source` immutable. Column semantics enumerated.
12. **Email normalization unstated** — specified `trim().toLowerCase()` before validation/insert.
13. **CHECK-constraint 500s / unvalidated `source` / unbounded `utm` jsonb** — API now validates `review_timing` (400), coerces `source` to enum, whitelists UTM keys with length caps.
14. **No form error UX** — specified per failure mode (invalid email, 429, network, success). Disposable-domain block kept deliberately (gate data quality) and noted as a trade-off.
15. **`sendBroadcast` can't support per-recipient events / no `user_id` in query** — verified; PRD now specifies the required extension (select `user_id`, return per-batch recipient lists) and acknowledges per-batch success granularity.
16. **Null `user_id` distinct-id ambiguity** — specified: `user_id` else SHA-256(email) for `career_email_sent`; `user_id` → `ph_distinct_id` → SHA-256(email) for `career_waitlist_joined`. Emails are hashed so PostHog never stores a raw email as an identifier (CodeRabbit privacy finding).
17. **Idempotency guard hand-waved (where's the marker? ordering? concurrency?)** — specified: `campaign_sends` table (same migration), marker inserted *before* send (PK constraint = atomic concurrency guard), fail-closed with `force: true` escape, dry-run/test exempt.
18. **`FROM_EMAIL` guard at wrong layer** — route asserts env *and* passes explicit `from` to `sendBroadcast`, covering the `testEmail` path too.
19. **CRON_SECRET-for-admin conflation** — acknowledged as accepted trade-off (single operator), route placed under `/api/admin/`; timing-safe `verifyCronAuth` mandated (model route's naive compare called out).
20. **Send-route duration unbudgeted (PostHog `flushAt: 1` per event)** — specified local batched PostHog client (`flushAt: 100`, awaited `shutdown()`) and `maxDuration = 300`.
21. **Sent vs delivered gate denominator** — surfaced as explicit measurement definition + Open Question 4/7; conservative-bias noted; no webhook built (Non-Goal).
22. **Hardcoded CTA domain** — switched to `NEXT_PUBLIC_APP_URL` per `shared.ts` convention.
23. **Banner "active users" dropped silently** — deviation now explicit: dashboard placement is the activity filter; no extra criterion for a validation phase.
24. **Banner stacking unaddressed** — specified ordering after existing banners and suppression when the hired banner shows.
25. **localStorage dismissal overclaim in user story** — reworded to "on that device."
26. **Banner copy pre-answered positioning question** — replaced with neutral copy; §8.5 remains open.
27. **"Mirrors §8" false; price-point question dropped** — Open Questions rewritten; §8.4 price point restored (Open Question 5).
28. **Qualifying-question placement is gate-affecting design, not implementation detail** — promoted to Open Question 6 with the trade-off stated; single-form remains the default.
29. **2-week delta report ownership** — assigned: agent ships insights + report template now; owner/follow-up run fills numbers; tiny-N caveat documented in the analysis file.
30. **`after()` test claim optimistic** — test scope corrected: assert error-response shape via route tests; analytics capture covered by module mock, not `after()` harness work.
31. **Bot inflation of `viewed` / spoofable client-forwarded UTMs** — documented; gate reads `joined` + DB.
32. **Backfill script unnamed** — named (`scripts/backfill-resend-audiences.mjs`) in Open Question 1 and Deliverable 1.
33. **PostHog project ambiguity** — recon revealed the MCP default project (473787) is not AppTrack; all insight work pinned to project 55190 throughout.
