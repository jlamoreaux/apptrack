# Task Breakdown: Career Companion Phase 0 + Roast Funnel P0 Fix

Source: `.claude/ship/PRD.md` (revised after adversarial review) · Baseline data: `.claude/ship/roast-funnel-analysis.md`
Stack: Next.js 15 / Supabase / Resend / PostHog (project 55190) / Upstash · Gates per task: `npx tsc --noEmit` (no NEW errors vs baseline; T7 removes the 3 roast errors) → `pnpm test` (jest) → new-test check → review → `next lint`.

Prior `TASKS.md` (retention strategy) was fully complete and is superseded by this file.

## Task 1: Migration 031 — `career_waitlist` + `campaign_sends`
- [ ] 1.1: Write `schemas/migrations/031_career_waitlist.sql`: `career_waitlist` (unique email, nullable user_id FK, `review_timing` CHECK, `source` CHECK in ('email','banner','direct'), `utm` jsonb, created_at) + `campaign_sends` (campaign PK, sent_at, recipient_count, metadata). RLS service-role only on both.
- [ ] 1.2: Add shared constants `lib/constants/career.ts`: `REVIEW_TIMING_OPTIONS` (values + labels), `CAREER_CAMPAIGN` id, waitlist source enum — single source of truth mirrored by the SQL CHECKs.
- [ ] 1.3: Apply via `./scripts/run-schema.sh schemas/migrations/031_career_waitlist.sql` (runs against the live DB — verify SQL by review first).
- [ ] 1.4: Write tests for Task 1: constants shape/values match the SQL CHECK lists (guards drift).

## Task 2: Career analytics module
- [ ] 2.1: `lib/analytics/career-events.ts` mirroring `campaign-events.ts`: private capture helper merging `getStoredUTMParams()`, typed `trackCareerWaitlistViewed`, `trackCareerEmailClicked` (sessionStorage de-dupe), `trackCareerBannerClicked`, `trackCareerBannerDismissed`. Event names: `career_waitlist_viewed`, `career_email_clicked`, `career_banner_clicked`, `career_banner_dismissed` (snake_case, exported constants).
- [ ] 2.2: Write tests for Task 2: mock `capturePostHogEvent`; assert names, UTM merge, and clicked de-dupe.

## Task 3: Waitlist API — `POST /api/career-waitlist`
- [ ] 3.1: Route: normalize email (trim/lowercase), validate via `lib/email/validate.ts`, validate `review_timing` (400 on mismatch), coerce `source` to enum (unknown → 'direct'), whitelist `utm` (5 keys, ≤200 chars), Upstash IP rate limit via `lib/services/rate-limit.service.ts`, resolve `user_id` from session only, insert `ON CONFLICT (email) DO NOTHING` via service-role client. No drip scheduling.
- [ ] 3.2: Fire server-side `career_waitlist_joined` (distinct id: `ph_distinct_id` → `user_id` → email) with `review_timing`, `source`, UTMs — only when a row was actually inserted; re-join returns success without event.
- [ ] 3.3: Write tests for Task 3: 400s (bad email, bad timing), source coercion, normalization, conflict path (no event, still 2xx), 429, event props.

## Task 4: `/career` landing page + join form
- [ ] 4.1: `app/(marketing)/career/page.tsx` (server): `getUser()` → pass `userEmail` prop; headline "Get promoted faster.", honest pitch, marketing-style primitives, CLAUDE.md UI rules (no emojis, py-16, max-w-6xl, 44px targets).
- [ ] 4.2: Client form component: pre-filled email + required review-timing dropdown (from `REVIEW_TIMING_OPTIONS`), single submit to `/api/career-waitlist` with `ph_distinct_id` + stored UTMs + derived `source`; explicit error states (invalid email / 429 / network) and success state.
- [ ] 4.3: Fire `career_waitlist_viewed` on mount (+ `career_email_clicked` when `utm_campaign=career_companion_validation`).
- [ ] 4.4: Write tests for Task 4: form renders/prefills, submit success + each error state, viewed/clicked firing logic.

## Task 5: Dashboard waitlist banner
- [ ] 5.1: `components/career-waitlist-banner.tsx` modeled on `hired-subscription-banner.tsx`: localStorage key `career-waitlist-banner-dismissed:${userId}`, neutral copy, CTA → `/career?utm_source=in_app&utm_medium=banner&utm_campaign=career_companion_validation`, fires banner events.
- [ ] 5.2: Wire into `app/(app)/dashboard/page.tsx` after existing banners; suppress when the hired banner is showing.
- [ ] 5.3: Write tests for Task 5: hidden when dismissed/suppressed, dismissal persists, events fire.

## Task 6: Validation email — template, broadcast extension, admin trigger route
- [x] 6.1: Extend `lib/email/broadcast.ts`: `getSubscribedMembers` selects `user_id`; `sendBroadcast` accepts explicit `from` and returns per-batch successful recipient lists `{email, userId}[]` (keep existing callers compiling).
- [x] 6.2: `lib/email/templates/career-validation.ts`: draft copy per PRD (core question, 2–3 sentence intro, single CTA built from `NEXT_PUBLIC_APP_URL` + UTM params), composed with `wrapEmail`/`ctaButton`. Mark copy as owner-approval-required in the file header comment.
- [x] 6.3: `app/api/admin/career-validation-email/route.ts`: `verifyCronAuth`, `maxDuration = 300`, body `{dryRun, testEmail, audiences?, force?}`; assert `FROM_EMAIL` before any send; default audiences free/trial/paid; `campaign_sends` marker inserted before send (PK = concurrency guard; `force` to resend); per-recipient `career_email_sent` via a local batched PostHog client (`flushAt: 100`, awaited `shutdown()`); persist recipient_count on the marker row.
- [x] 6.4: Write tests for Task 6: auth rejection, dry-run (counts, no send, no marker), FROM_EMAIL guard, idempotency (second call 409 without force), event capture per successful batch, testEmail path.

## Task 7: Roast API bug fixes (telemetry blackout)
- [x] 7.1: Fix `app/api/roast/route.ts` — hoist `user` out of the `try` (fixes :429 catch ReferenceError and :106 never-type); error path returns the designed JSON error + fires `api_error`.
- [x] 7.2: Fix `app/api/roast/[id]/route.ts:91` — hoist `id` so the catch logger works and the designed 500 JSON is returned.
- [x] 7.3: Verify `npx tsc --noEmit` no longer reports the three roast errors (and nothing new vs baseline).
- [x] 7.4: Write tests for Task 7: error paths of both routes return designed shape/status; `api_error` capture called with defined user value (analytics module mocked).

## Task 8: Roast results-page conversion repair (the measured P0)
- [x] 8.1: Restructure the signup CTA in `roast-display.tsx` (v1 + v2 variants) into a value-forward conversion module after the score/summary (benefit bullets: save roast, track applications, improvement tips) + secondary CTA at page end; add `placement` property to `roast_signup_clicked`; add UTM params (`utm_source=roast&utm_medium=results_page&utm_campaign=roast_funnel`) to CTA links for signup attribution via the existing cookie mechanism. (Also mounted `useUTMTracking()` in `signup-page-client.tsx` — the `apptrack_utm` cookie writer was previously mounted nowhere, so `/auth/callback` attribution would have received nulls.)
- [x] 8.2: Add `roast_file_selected` client event on file pick (both landing pages); register it and `roast_try_another` in `ROAST_EVENTS`.
- [x] 8.3: Write tests for Task 8: CTA module renders for creator/visitor variants, events fire with `placement`, CTA hrefs carry UTMs.

## Task 9: PostHog artifacts (project 55190) + delta report scaffold
- [ ] 9.1: Create dashboard "Career Companion Phase 0 Gate": (a) trends sent/clicked/viewed/joined + join-rate formula, (b) funnel viewed→joined broken down by `source`, (c) joined breakdown by `review_timing` — gate thresholds in descriptions.
- [ ] 9.2: Create roast before/after funnel insights (pre-fix fixed-range, post-fix rolling; landing pinned to `/roast-my-resume`) + ship-date annotation.
- [ ] 9.3: Write `.claude/ship/roast-delta-report.md` template (baseline numbers filled from the analysis; post-fix section + tiny-N caveat for the owner to complete after 2 weeks).
- [ ] 9.4: Verify (in lieu of unit tests — external artifacts): re-fetch each insight via MCP; confirm queries reference existing events and return without error.

## Doc sweep
Performed (README, docs/, .env.example, roast PRD): no existing doc is made factually wrong by these changes — no doc task created.

## Known trade-offs (logged per review)
- CRON_SECRET reused for the admin trigger route (single-operator project).
- `career_email_clicked` means "landed from email" (no independent click signal without Resend click-tracking — Open Question 7).
- Banner dismissal is per-device (matches existing pattern).
- Gate denominator is Resend-accepted sends, not delivered (conservative bias).
