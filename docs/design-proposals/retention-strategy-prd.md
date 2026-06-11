# AppTrack Retention Strategy - Product Requirements Document

## Overview

**Feature Name:** Retention Loop (Activation + Lifecycle Emails + AI Coach Anchor)
**Product:** AppTrack (apptrack.ing)
**Priority:** Critical (0% day-1 retention)
**Companion doc:** `docs/design-proposals/retention-strategy-rfc.md`
**Target Release:** Phased, ~4 weeks solo dev (evenings/weekends)

## Problem Statement

AppTrack acquires users but retains none: day-1 and day-7 retention are both 0% across every daily
cohort (May 25 – June 8, confirmed in PostHog project 55190). New users land on an empty dashboard,
nothing pulls them back, and the paid AI Coach differentiator is hidden. The product has an
acquisition pipeline but no retention loop. This PRD specifies the build to create one.

## Goals & Success Metrics

### Primary Goals
- Get every new user to a populated pipeline in their first session (activation).
- Create external lifecycle triggers that bring activated users back.
- Surface the AI Coach to every new user without breaking the paywall.

### Success Metrics (90-day, baselines confirmed)

| Metric | Baseline | Target |
|---|---|---|
| Day-1 retention | 0% | 15% |
| Day-7 retention | 0% | 8% |
| Avg pages/session (new users) | 1.8 | 4+ |
| Signup → first job tracked | ~20% | 60% |
| AI Coach discovery (new users) | ~12% | 80% |
| Return visits within 7 days | 0 | 30% of activated users |
| Drip open rate | — | 25% |
| Stale-reminder click-through | — | 10% |

## Stack Constraints (must honor)

- Next.js 15 App Router on Vercel; **no Cloudflare/D1/Workers**.
- Supabase/Postgres; FK target is **`profiles(id)`**, `gen_random_uuid()`, `TIMESTAMPTZ`, RLS per the
  pattern in `schemas/drip_emails.sql`.
- Scheduled jobs = **Vercel Cron** routes under `app/api/cron/**`, guarded by `CRON_SECRET`.
- LLM = **OpenAI**; cost model `gpt-4o-mini` (`lib/openai/models.ts`). No Anthropic.
- Email = **Resend** (`lib/email/*`). Already in production.
- Rate limiting = **Upstash Redis** (`lib/redis/client.ts`).
- Client components must call API routes, never Supabase directly (per CLAUDE.md).
- Check `schemas/` before writing DB code. Status enum:
  `['Applied','Interview Scheduled','Interviewed','Offer','Hired','Rejected']`; `archived` boolean.

---

## Phase 1: Guided First Job Import

### User Stories
- As a new user, after choosing a plan I'm prompted to add my first job, not dropped on an empty dashboard.
- As a new user, I can paste a job URL and have company/title/location pre-filled for me.
- As a new user in a hurry, I can add a job with just company + role.

### Functional Requirements

**FR1.1 — Onboarding step placement.** After plan selection on `/onboarding/welcome`
(`app/(app)/onboarding/welcome/page.tsx`) and before the empty dashboard, render an "Add your first
job" step. Use existing onboarding state (`schemas/onboarding.sql`, `lib/utils/user-onboarding.ts`).

**FR1.2 — URL extraction endpoint (net-new, non-gated).** New route
`app/api/onboarding/extract-job/route.ts`:
- Authenticated, but **NOT** behind `checkAICoachAccess` — available to all signed-in users.
- Reuse the HTML fetch + cleaning logic already in
  `app/api/ai-coach/fetch-job-description/route.ts`.
- Call OpenAI `gpt-4o-mini` with a structured-extraction prompt returning JSON:
  `{ company, title, location, posting_url, description_summary }`.
- Rate-limit to **5 extractions/user/hour** via the existing Upstash limiter.
- On failure/unsupported URL, return a clear error so the UI falls back to manual entry.

**FR1.3 — Pre-fill + save.** Map extracted fields onto the add-application form
(`app/(app)/dashboard/add/page.tsx`): `company`, `role` (from `title`), `role_link` (from
`posting_url`), `job_description` (from `description_summary`). User confirms; save through the
existing path (`hooks/use-supabase-applications.ts` → `POST /api/applications`).

**FR1.4 — Quick manual entry.** Minimal form: `company` + `role` required, everything else optional.

**FR1.5 — Post-save.** Redirect to dashboard with the entry visible; secondary CTAs "Add another" and
"Try the AI Coach" (links into Phase 3 onboarding insight).

### Acceptance Criteria
- A new user who pastes a valid LinkedIn/Indeed/Greenhouse/Lever URL sees the form pre-filled and can
  save in ≤2 clicks.
- Extraction failures degrade gracefully to manual entry with no dead end.
- Rate limit returns a friendly message on the 6th extraction within an hour.
- 60% of new signups complete ≥1 job entry in their first session.

---

## Phase 2: Lifecycle Emails

> Most infrastructure already exists: `lib/email/client.ts`, `lib/email/drip-scheduler.ts`,
> `app/api/cron/drip-emails/route.ts` (every 4h in `vercel.json`), `schemas/drip_emails.sql`
> (`audience_members` + `drip_emails`), `app/api/email/unsubscribe/route.ts`, and templates in
> `lib/email/templates/drip.ts`. This phase wires + fills gaps.

### 2a. Post-Signup Drip (mostly existing)

**FR2.1** Trigger the drip on authenticated signup by enrolling the user into the `free-users` /
`trial-users` audience and scheduling the existing templates:

| Timing | Template | Status |
|---|---|---|
| +1h | "Your pipeline is started" | New (small) |
| +1d | "3 Tips to Improve Your Job Search" | Exists |
| +3d | "How's Your Job Search Going?" | Exists |
| +7d | "Your weekly pipeline review" | New (uses 2c) |

### 2b. Stale Application Reminders (net-new — highest value)

**FR2.2** New daily Vercel Cron `app/api/cron/stale-reminders/route.ts` (guarded by `CRON_SECRET`;
add to `vercel.json`):
- Query applications where `updated_at < NOW() - INTERVAL '5 days'`, `status NOT IN
  ('Offer','Hired','Rejected')` (terminal states only), and `archived = false`.
- Group by user; send **one consolidated email per user per day** via Resend, listing all stale jobs.
- Honor `email_preferences.reminders_enabled` and `unsubscribed_all`.
- CTA deep-links to the specific application with the status picker open.

### 2c. Weekly Pipeline Digest (net-new)

**FR2.3** New Vercel Cron `app/api/cron/weekly-digest/route.ts` (Monday AM; distinct from the
existing `generate-changelog` Monday cron):
- Per user with active jobs, compute: active count, count needing follow-up, new since last week.
- Inject one AI Coach insight sentence (see Phase 3 digest insight).
- Honor `email_preferences.digest_enabled`.

### Schema (Postgres — extend, do not duplicate)

**FR2.4** Add per-category preferences (the existing `audience_members.subscribed` is a single
boolean; reuse `drip_emails` for send/state and extend with `opened_at`/`clicked_at` if open/click
tracking is wanted):
```sql
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  drip_enabled BOOLEAN NOT NULL DEFAULT true,
  reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  digest_enabled BOOLEAN NOT NULL DEFAULT true,
  unsubscribed_all BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;
-- owner SELECT + service_role ALL, mirroring schemas/drip_emails.sql
```

**FR2.5** Extend `app/api/email/unsubscribe/route.ts` and `isUserSubscribed` to honor the
per-category flags above. Apply migration via `./scripts/run-schema.sh`.

### Acceptance Criteria
- Drip enrolls on signup and respects unsubscribe immediately.
- Stale reminder fires for an `Applied` job untouched 5+ days; does NOT fire for `Offer`/`Hired`/
  `Rejected` or archived jobs; max one reminder email/user/day.
- Weekly digest renders correct counts and one AI insight; suppressed when `digest_enabled = false`.
- Drip open rate ≥25%; stale-reminder CTR ≥10%; D7 retention reaches 8% within 60 days.

---

## Phase 3: AI Coach as Onboarding Anchor (Option A)

### Decision
**Option A (locked):** a single, **non-gated, fixed-cost** onboarding insight that does NOT consume
trial budget. Full AI Coach stays gated behind the paid plan / trial.

### Functional Requirements

**FR3.1 — Onboarding insight (non-gated path).** After the first job is added (Phase 1), generate one
3–4 sentence insight using the just-added job as context. Reuse `lib/ai-coach/coach.ts` /
`lib/ai-coach/functions.ts` logic but route through a path that does **not** call
`checkAICoachAccess` and does **not** decrement `TRIAL_BUDGET` (whose tools are
`['job_fit','interview_prep','cover_letter']`, none of which is this insight). Model: `gpt-4o-mini`.

**FR3.2 — CTA.** "Want more coaching? The AI Coach is in your dashboard." For free users this is the
upgrade/trial entry point into `/dashboard/ai-coach`.

**FR3.3 — Digest insight.** In the weekly-digest cron, generate one `gpt-4o-mini` insight per user
with active jobs (pipeline-composition based), cache in Postgres for template injection.

### Acceptance Criteria
- 80% of users who complete Phase 1 activation also see an onboarding insight.
- Free users receive the insight without hitting a 403 and without losing trial budget.
- `/dashboard/ai-coach` visits increase 3x from baseline.

---

## Phase 4: Passive Pipeline Population (Deferred)

Scope only after Phases 1–3 are live and measured. **4a** Gmail ATS detection (read-only sensitive
scope, separate from existing Supabase Google sign-in; ~10–15d). **4b** Job recommendation feed
(~8–12d). Cut if Phases 1–3 hit targets.

---

## Analytics & Instrumentation

PostHog is integrated (`lib/analytics/posthog.ts`, `capturePostHogEvent`;
`lib/analytics/conversion-events.ts`). Reuse existing events; add new ones:

| Event | Properties | Phase | Status |
|---|---|---|---|
| `signup_completed` | existing | 1 | Reuse |
| `first_application_added` | existing | 1 | Reuse |
| `onboarding_job_import_started` | `method: url_paste \| manual` | 1 | New |
| `onboarding_job_import_completed` | `method, extraction_success` | 1 | New |
| `onboarding_job_import_skipped` | — | 1 | New |
| `email_sent` / `email_opened` / `email_clicked` | `type, user_id[, cta_target]` | 2 | New |
| `email_unsubscribed` | `category` | 2 | New |
| `ai_coach_onboarding_shown` | — | 3 | New |
| `ai_coach_onboarding_cta_clicked` | — | 3 | New |

**Funnels:** (1) signup → first job → return within 7d; (2) email sent → opened → clicked → in-app
action; (3) coach onboarding shown → CTA clicked → dashboard coach used.

## Out of Scope
- Switching email providers (Resend is set).
- Any Anthropic/Cloudflare migration.
- User-configurable stale threshold (ship fixed 5 days; revisit later).
- Phase 4 implementation (separate PRD when greenlit).

## Risks
- URL extraction reliability across boards → fallback to manual; build patterns incrementally; log failures.
- Email deliverability → verify DKIM/SPF/DMARC on Resend domain; monitor bounces.
- Insight cannibalizing upgrade → Option A keeps full Coach gated.
- Scope creep → ship each phase independently and measure before the next.

## Rollout
1. Phase 1 behind onboarding for new users; monitor activation funnel.
2. Phase 2a enrol on signup; 2b/2c crons after preference schema migration.
3. Phase 3 insight after Phase 1 is stable.
4. Weekly PostHog lifecycle review; greenlight each next phase on measured impact.

## Implementation Status (initial delivery)

Shipped on branch `claude/apptrack-retention-rfc-F7imt`:

- **Phase 1:** `lib/onboarding/job-extraction.ts` (+ SSRF host guard), non-gated rate-limited route
  `app/api/onboarding/extract-job`, UI `components/onboarding/first-job-step.tsx` rendered at
  `app/(app)/onboarding/first-job`. Free-plan selection now routes here
  (`lib/checkout/create-checkout.ts`).
- **Phase 2:** migration `schemas/migrations/030_retention_email_preferences.sql`; preferences
  service `lib/email/preferences.ts` + API `app/api/email/preferences`; stale reminders
  (`lib/email/stale-reminders.ts` + cron) and weekly digest (`lib/email/weekly-digest.ts` + cron),
  templates in `lib/email/templates/lifecycle.ts`; paginated query helper
  `lib/email/application-rows.ts`; two `vercel.json` crons; per-category unsubscribe in
  `app/api/email/unsubscribe`.
- **Phase 3:** `lib/ai-coach/onboarding-insight.ts` + non-gated route
  `app/api/onboarding/coach-insight` (Option A — no trial-budget spend); digest insight reuses it.
- **Analytics:** new events/properties in `lib/analytics/conversion-events.ts`.
- **Tests:** 26 unit tests across extraction, insight, preferences, stale grouping, digest summary,
  templates, and the SSRF guard.

Known follow-ups (not blocking initial delivery):
- Migration `029` must be applied via `./scripts/run-schema.sh` before the crons/preferences are live.
- Paid-plan signups still land on the dashboard (Stripe success flow unchanged); only free-plan users
  get the guided step today. Wiring the post-checkout path is a follow-up.
- Per-category unsubscribe is supported by the API but the lifecycle email templates still link the
  account-wide unsubscribe; adding `&category=` to those links is a follow-up.
- `first-job-step.tsx` needs visual QA (cannot run the app per CLAUDE.md).
- Lint gate (`next lint`) could not run — eslint is not installed in the build environment.

