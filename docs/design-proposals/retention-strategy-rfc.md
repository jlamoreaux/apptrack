# RFC: AppTrack Retention Strategy

**Author:** Jordan Lamoreaux
**Date:** 2026-06-08
**Status:** Draft (rev. 2 — retargeted to actual stack)
**Project:** AppTrack (apptrack.ing)

> **Revision note (rev. 2):** The original draft described a Cloudflare Workers + D1 + AI Gateway
> stack. AppTrack actually runs on **Next.js 15 (App Router) on Vercel, Supabase/Postgres, Vercel
> Cron, OpenAI, and Resend**. This revision retargets every technical section accordingly, and —
> importantly — reframes Phase 2 around the **email infrastructure that already exists in
> production** rather than building it from scratch. Implementation-status callouts reference the
> actual files so each phase starts from what's really there.

-----

## 0. Current Architecture (Ground Truth)

Before the proposal, the stack the rest of this document assumes:

| Concern | Technology | Key locations |
|---|---|---|
| Framework | Next.js 15 (App Router) | `app/`, `next.config.mjs` |
| Hosting | Vercel | `vercel.json` |
| Database | Supabase / Postgres | `lib/supabase/*`, `schemas/*.sql` |
| Scheduled jobs | Vercel Cron | `vercel.json` `crons[]`, `app/api/cron/**` |
| LLM | OpenAI (`gpt-4o-mini` default, `gpt-4o` premium) | `lib/openai/client.ts`, `lib/openai/models.ts` |
| Email | Resend | `lib/email/*`, `app/api/cron/drip-emails/route.ts` |
| Rate limiting / cache | Upstash Redis | `lib/redis/client.ts`, `schemas/ai_rate_limiting.sql` |
| Payments | Stripe | `lib/stripe/*` |
| Analytics | PostHog (+ Vercel Analytics) | `lib/analytics/posthog.ts`, `lib/analytics/conversion-events.ts` |

Notable implications used throughout:

- **No Cloudflare anything.** Cron = Vercel Cron hitting authenticated `app/api/cron/**` routes
  guarded by `CRON_SECRET`. Background "Workers" = Next.js route handlers.
- **Postgres, not D1.** Schema uses `gen_random_uuid()`, `TIMESTAMPTZ`, and the user FK is
  **`profiles(id)`**, not `users(id)`.
- **OpenAI, not Anthropic.** "Cost-optimized model" = `gpt-4o-mini` (already the default in
  `lib/openai/models.ts`).

-----

## 1. Problem Statement

PostHog analytics from the past 14 days reveal a critical retention failure. AppTrack is acquiring
new users through Reddit campaigns, organic search, and referral traffic, but day-1 retention is
**0% across every daily cohort** from May 25 through June 8. Weekend data (June 6–8) showed 17
unique visitors, a 40% signup-to-dashboard conversion rate, and an average session depth of 1.8
pages per user. Only 2–3 users performed any meaningful in-product action (adding a job, viewing
applications, or using AI Coach). No user returned the following day.

The product has an acquisition pipeline. It does not have a retention loop.

> **Validation TODO:** These baseline numbers are stated from a dashboard glance and should be
> confirmed against PostHog (project 55190) — lifecycle view for D1/D7 retention, and the
> signup → first-application funnel — before greenlighting. The conclusion (no retention loop) is
> almost certainly correct regardless; the exact figures should be pinned for the success-criteria
> baselines below.

### Key Metrics (Baseline)

|Metric                           |Current Value  |Target (90-day)       |
|---------------------------------|---------------|----------------------|
|Day-1 retention                  |0%             |15%                   |
|Day-7 retention                  |0%             |8%                    |
|Avg pages per session (new users)|1.8            |4+                    |
|Signup → first job tracked       |~20% (est.)    |60%                   |
|Users who discover AI Coach      |~12% of signups|80% of signups        |
|Return visits within 7 days      |0              |30% of activated users|

-----

## 2. Root Cause Analysis

Three structural problems explain the retention gap:

### 2.1 Empty State Death

New users complete OAuth and are routed to `/onboarding/welcome` — which today is a **plan-selection /
upsell screen** (`app/(app)/onboarding/welcome/page.tsx`) — and then land on an empty dashboard with
no tracked jobs and no immediate reason to stay. A job tracker with zero jobs has zero value. The
flow guides the user toward a plan choice, not toward populating their pipeline, so most users see
the homepage, maybe the dashboard, and leave. The average 1.8 pages/session is consistent with this.

### 2.2 No Pull Triggers

Email infrastructure exists (see §3, Phase 2), but the lifecycle triggers that would bring an
*authenticated, activated* user back — "you have stale applications," "here's your weekly pipeline"
— do not. Job seekers live in their inbox. The signal that matters most ("did I hear back yet?")
is never sent.

### 2.3 Core Value Prop Is Hidden

The AI Coach is AppTrack's strongest differentiator from spreadsheet trackers and competitors like
Huntr or Teal. Only ~12% of weekend signups encountered it. It lives at `/dashboard/ai-coach`
(`app/(app)/dashboard/ai-coach/page.tsx`) as a destination the user must actively navigate to, and
it is **gated behind the paid "AI Coach" plan** (`lib/middleware/ai-coach-auth.ts`). Users who never
see it have no reason to prefer AppTrack over a Google Sheet.

-----

## 3. Proposed Solution

Four interventions, ordered by expected impact-to-effort ratio. Each phase is independently shippable.

### Phase 1: Guided First Job Import (Activation Fix)

**Goal:** Every new user has at least one tracked job before their first session ends.

**Implementation status (what already exists):**

- A URL→text fetcher exists at `app/api/ai-coach/fetch-job-description/route.ts`, **but** (a) it is
  gated behind `checkAICoachAccess()` (paid-only), and (b) it returns raw description text via regex
  HTML stripping — **not** structured `{company, title, location, ...}`.
- Onboarding state is already tracked (`schemas/onboarding.sql`, `lib/utils/user-onboarding.ts`,
  `isNewUser()`).
- The manual add-job form (`app/(app)/dashboard/add/page.tsx`) already covers the target fields,
  which match `schemas/applications.sql`: `company`, `role`, `role_link`, `job_description`,
  `date_applied`, `status`.
- Rate-limiting infra (Upstash Redis `lib/redis/client.ts` + `schemas/ai_rate_limiting.sql`) exists
  to reuse — no new infra needed for the abuse limit.

**Scope:**

Insert a guided activation step into the existing onboarding flow. **Sequencing decision:** the
first-job prompt comes **after** plan selection on `/onboarding/welcome`, so we don't bury the
upgrade moment — but before the user reaches the empty dashboard.

1. After plan selection is dismissed, present a focused "Add your first job" prompt instead of
   dropping the user on the empty dashboard.
1. Support two input modes:
   - **Paste a URL:** User pastes a job listing URL (LinkedIn, Indeed, Greenhouse, Lever, etc.). A
     **new, non-paywalled** Next.js route handler fetches the page, strips it to text, and calls
     OpenAI (`gpt-4o-mini`) with a structured-extraction prompt → returns JSON
     (`company`, `title`, `location`, `posting_url`, `description_summary`). Pre-fill the add-job
     form; user confirms and saves.
   - **Quick manual entry:** Minimal form, `company` + `role` only, everything else optional. Reuse
     the existing add-application path (`hooks/use-supabase-applications.ts` → `POST /api/applications`).
1. After the first job is saved, redirect to the dashboard with the entry visible. Secondary CTA:
   "Add another" or "Try the AI Coach" (see Phase 3).

**Technical Approach:**

- New route handler (e.g. `app/api/onboarding/extract-job/route.ts`): authenticated but **not**
  behind `checkAICoachAccess` — available to all new users. Fetch target URL → strip to text (reuse
  the cleaning logic already in `fetch-job-description`) → OpenAI structured extraction → JSON.
- Rate-limit via the existing Upstash limiter: 5 extractions per user per hour.
- Fallback to manual entry if extraction fails or the URL is unsupported.
- Store extraction source URL in the application's `role_link` (and optionally raw source in
  metadata) for potential future re-scraping.

**Success Criteria:**

- 60% of new signups complete at least one job entry in their first session (up from ~20%).
- Average pages per first session increases to 4+.

**Estimated Effort:** 3–5 days. (URL-fetch + cleaning already exist; net-new is the LLM structured
extraction, the non-gated route, and the onboarding UI step.)

-----

### Phase 2: Lifecycle Emails (Pull Triggers)

**Goal:** Create external triggers that bring *authenticated, activated* users back after their
first session.

**Implementation status — most of this is already built and running:**

- **Sending:** Resend wired in `lib/email/client.ts`, `lib/email/transactional.ts`,
  `lib/email/broadcast.ts`.
- **Drip engine:** `lib/email/drip-scheduler.ts` (`getPendingDrips`, `markDripSent`,
  `markDripFailed`, `isUserSubscribed`) driven by `app/api/cron/drip-emails/route.ts`, **already
  scheduled every 4 hours** in `vercel.json`.
- **Schema:** `schemas/drip_emails.sql` already defines `audience_members` (audiences: `leads`,
  `free-users`, `trial-users`, `paid-users`; `subscribed` flag; `resend_contact_id`) and
  `drip_emails` (scheduling, status, `UNIQUE(email, template_id)` dedup).
- **Unsubscribe:** `app/api/email/unsubscribe/route.ts` exists (CAN-SPAM one-click handled).
- **Templates:** `lib/email/templates/drip.ts` already contains "Welcome to AppTrack," "3 Tips to
  Improve Your Job Search," "How's Your Job Search Going?," "Try Your First AI Feature," "Have You
  Tried Interview Prep Yet?" — these map almost 1:1 to the post-signup drip below.

**Therefore Phase 2 is mostly *wiring and gap-filling*, not greenfield.**

#### 2a. Post-Signup Drip Sequence — *mostly existing*

Map the authenticated-signup trigger to the existing `free-users` / `trial-users` audiences and the
existing templates. Add/adjust templates only where the desired message has no equivalent.

|Timing |Email                             |Purpose                                                 |Status|
|-------|----------------------------------|--------------------------------------------------------|------|
|+1 hour|"Your pipeline is started"        |Reinforce first job entry, link to AI Coach             |New template (small)|
|+1 day |"3 things AppTrack can do for you"|Feature education (AI Coach, status tracking, analytics)|Exists ("3 Tips…")|
|+3 days|"How's the search going?"         |Nudge to add more jobs or update statuses               |Exists ("How's Your Job Search Going?")|
|+7 days|"Your weekly pipeline review"     |First AI-generated summary of their pipeline state      |New (depends on 2c)|

#### 2b. Stale Application Reminders — *net-new (highest value)*

Triggered when a tracked job hasn't had a status update in N days (default 5):

> "Still waiting on [Company] for [Job Title]? Update the status or mark it as no response."

CTA deep-links to that specific application with the status picker open. This is the single
highest-value retention mechanism because it mirrors the user's actual mental state: everyone
wonders "did I hear back yet?" and this email meets them at that moment.

**Technical approach:** a new Vercel Cron route (e.g. `app/api/cron/stale-reminders/route.ts`,
guarded by `CRON_SECRET`, daily). Query Supabase for applications where
`updated_at < NOW() - INTERVAL '5 days'` and `status NOT IN ('Offer', 'Hired', 'Rejected')` plus
`archived = false`. Only those three are **terminal** states in the real enum
(`schemas/applications.sql`: `['Applied', 'Interview Scheduled', 'Interviewed', 'Offer', 'Hired',
'Rejected']`) — `Applied`, `Interview Scheduled`, and `Interviewed` are all still "awaiting a
response," so they should receive reminders. Group by user, send **one consolidated email per user
per day** via Resend, respecting the user's email preferences (see schema below).

> Note: the original draft referenced statuses `'rejected'`, `'withdrawn'`, `'ghosted'` — those are
> not the real enum. AppTrack uses an `archived` boolean for removed items, not a status. Adjusted
> accordingly.

#### 2c. Weekly Pipeline Digest — *net-new*

Every Monday morning (new Vercel Cron route; note the existing Monday `generate-changelog` cron is a
**product** changelog, not a per-user digest — this is separate):

> "This week: X active applications, Y need follow-up, Z new since last week. [AI Coach insight
> based on pipeline composition.]"

Provides value even without a click-through, building trust and brand affinity.

**Schema additions (Postgres — extend, don't duplicate):**

The original draft proposed `email_events` and `email_preferences` tables in **SQLite/D1 dialect**
referencing a nonexistent `users` table. Those largely duplicate `drip_emails` (send/state tracking)
and `audience_members.subscribed` (suppression) that already exist. Instead:

```sql
-- Per-category preferences. audience_members already has a single `subscribed` boolean;
-- this adds the drip/reminders/digest split the lifecycle emails need.
CREATE TABLE IF NOT EXISTS email_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  drip_enabled BOOLEAN NOT NULL DEFAULT true,
  reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  digest_enabled BOOLEAN NOT NULL DEFAULT true,
  unsubscribed_all BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;
-- (mirror the RLS pattern in schemas/drip_emails.sql: owner SELECT + service_role ALL)
```

For send/open/click tracking, **reuse and extend `drip_emails`** (add the new `template_id`s for
stale reminders and digest, and add `opened_at` / `clicked_at` columns if open/click tracking is
desired) rather than introducing a parallel `email_events` table. The existing `unsubscribe` route
and `isUserSubscribed` check should be extended to honor the per-category flags above.

**Technical Approach (corrected):**

- **Email sending:** Resend (already integrated). No provider decision required — see Open Questions.
- **Scheduling:** Vercel Cron routes under `app/api/cron/**`, guarded by `CRON_SECRET`, following the
  existing `drip-emails` route pattern. Add `stale-reminders` (daily) and `weekly-digest` (Monday).
- **Stale reminders:** daily cron queries Supabase as described in 2b.
- **Unsubscribe:** existing `app/api/email/unsubscribe/route.ts`, extended for per-category flags.

**Success Criteria:**

- 25% email open rate on drip sequence.
- 10% click-through rate on stale reminders.
- Day-7 retention reaches 8% within 60 days of launch.

**Estimated Effort:** 3–4 days (down from 5–7). Infra, templates, and unsubscribe already exist; the
real work is the stale-reminder cron, the per-user digest cron + aggregation, the per-category
preference column, and 1–2 new templates.

-----

### Phase 3: AI Coach as Onboarding Anchor (Value Prop Surfacing)

**Goal:** 80%+ of new users experience the AI Coach within their first session.

**Paywall reality (must be resolved):** AI Coach is a **paid feature** —
`lib/middleware/ai-coach-auth.ts`'s `checkAICoachAccess()` returns 403 for free users. There is,
however, an existing **trial-budget** mechanism (`components/ai-coach/trial-onboarding.tsx`,
`TRIAL_BUDGET.LIMIT`) that grants free users limited AI access. "80% of new users see the AI Coach"
is only achievable through one of two routes:

- **Option A (recommended):** the onboarding insight is a **single, non-gated, server-generated
  insight** that does *not* consume trial budget. It's a fixed-cost teaser (one `gpt-4o-mini`
  completion) shown to every new user, with the full Coach still behind the paywall/trial. Keeps the
  upgrade incentive intact and cost predictable.
- **Option B:** the onboarding insight **spends trial budget** via the existing trial flow. Simpler
  to build (reuses trial path) but burns budget before the user is invested, and reduces the trial's
  later pull. 

This RFC recommends **Option A** and flags the choice for explicit sign-off.

**Scope:**

1. After the first job is added (Phase 1), present a single AI Coach insight: "Based on what you're
   looking for, here's my take on your approach," using the just-added job as context.
1. The insight is a brief (3–4 sentence) personalized take: gap analysis, resume keyword suggestion,
   or interview-prep tip relevant to the role/company.
1. End with a CTA: "Want more coaching? The AI Coach is in your dashboard." (For free users, this is
   the upgrade/trial entry point.)

Additionally, integrate AI Coach micro-insights into the weekly digest (Phase 2c): one
AI-generated sentence per digest based on pipeline composition. Examples:

- "You have 4 applications at FAANG companies but none at mid-stage startups. Diversifying could
  improve your response rate."
- "3 of your 5 active applications are for Senior roles. Consider adding a few Staff-level
  applications to test the market."

**Technical Approach:**

- Onboarding insight: reuse the existing AI Coach backend (`lib/ai-coach/coach.ts`,
  `lib/ai-coach/functions.ts`), pass the just-added job as context, constrain to 3–4 sentences via
  system prompt. Per Option A, route this through a path that does not invoke `checkAICoachAccess`
  and does not decrement trial budget.
- Digest insight: a batch step in the weekly-digest cron generates one insight per user with active
  jobs using `gpt-4o-mini` (the existing cost model — *not* "Haiku"), cached in Postgres for
  template injection.

**Success Criteria:**

- 80% of users who complete Phase 1 activation also see an AI Coach response.
- AI Coach destination visits (`/dashboard/ai-coach`) increase 3x from baseline.

**Estimated Effort:** 2–3 days (prompt engineering + onboarding UI + the non-gated insight path).

-----

### Phase 4: Passive Pipeline Population (Longer-Term)

**Goal:** The dashboard has new, relevant content even when the user hasn't manually added anything.

Higher effort; scope after Phases 1–3 are live and measured. Two options, not mutually exclusive.

#### 4a. Gmail Integration for Application Detection

Connect to the user's Gmail (OAuth scope: read-only) and scan for application-confirmation emails
from known ATS platforms (Greenhouse, Lever, Workday, iCIMS, Ashby, etc.). Auto-create applications
in `Applied` status with extracted company/role data. Surface on the dashboard as "Auto-detected
applications — confirm or dismiss." Shifts the value prop from "come log your jobs" to "we already
know what you applied to."

**Note:** AppTrack already authenticates via Supabase OAuth (Google sign-in exists). Gmail
*read* scope is a different, **sensitive** scope requiring Google's lengthy verification — separate
from the existing sign-in grant.

**Risks:** Google verification for sensitive scopes is lengthy; privacy concerns must be addressed in
UI and terms; offer as opt-in power feature.

**Estimated Effort:** 10–15 days.

#### 4b. Job Recommendation Feed

Based on the user's tracked jobs (titles, companies, locations), generate a daily feed of matching
open positions from public job boards or aggregator APIs. Surface as "Recommended for you." Gives a
reason to check AppTrack daily independent of the user's own activity.

**Risks:** Job-data freshness, ToS issues with scraping, relevance quality.

**Estimated Effort:** 8–12 days.

-----

## 4. Implementation Timeline

```
Week 1-2:  Phase 1 — Guided first job import (LLM extraction + onboarding step)
Week 2:    Phase 2a — Wire existing drip templates to authenticated signup
Week 2-3:  Phase 2b/2c — Stale reminders + weekly digest (net-new crons)
Week 3-4:  Phase 3 — AI Coach onboarding insight (non-gated path)
Week 5+:   Phase 4 — Scoping and measurement before committing
```

Solo-developer velocity, evenings/weekends. Each phase independently deployable and measurable.
Phase 2 is shorter than originally scoped because the email engine already exists.

-----

## 5. Measurement Plan

PostHog is already integrated (`lib/analytics/posthog.ts`, `capturePostHogEvent`;
`lib/analytics/conversion-events.ts`). **Reuse existing events where they exist** rather than
defining duplicates.

### PostHog Events

|Event                                |Properties                  |Phase|Status|
|-------------------------------------|----------------------------|-----|------|
|`signup_completed`                   |existing                    |1    |Exists|
|`first_application_added`            |existing                    |1    |Exists (reuse for activation)|
|`onboarding_job_import_started`      |`method: url_paste \| manual`|1   |New|
|`onboarding_job_import_completed`    |`method, extraction_success`|1    |New|
|`onboarding_job_import_skipped`      |—                           |1    |New|
|`ai_feature_discovered`              |existing                    |3    |Exists (reuse)|
|`email_sent`                         |`type, user_id`             |2    |New|
|`email_opened`                       |`type, user_id`             |2    |New|
|`email_clicked`                      |`type, user_id, cta_target` |2    |New|
|`email_unsubscribed`                 |`category`                  |2    |New|
|`ai_coach_onboarding_shown`          |—                           |3    |New|
|`ai_coach_onboarding_cta_clicked`    |—                           |3    |New|
|`auto_detected_application_confirmed`|`source: gmail`             |4a   |New|
|`auto_detected_application_dismissed`|`source: gmail`             |4a   |New|
|`recommended_job_viewed`             |`source`                    |4b   |New|
|`recommended_job_applied`            |`source`                    |4b   |New|

### Key Funnels

1. **Activation:** `signup_completed` → `onboarding_job_import_completed`/`first_application_added` →
   dashboard with data → return visit within 7 days.
1. **Email engagement:** `email_sent` → `email_opened` → `email_clicked` → in-app action.
1. **AI Coach discovery:** `ai_coach_onboarding_shown` → `ai_coach_onboarding_cta_clicked` →
   `/dashboard/ai-coach` visit → repeat usage.

### Retention Cohorts

Monitor the PostHog lifecycle view (new / returning / resurrecting / dormant) daily. Primary metric:
D1 and D7 retention climbing off the 0% baseline. Weekly review cadence.

-----

## 6. Risks and Mitigations

|Risk                                       |Likelihood|Impact               |Mitigation                                                                                                         |
|-------------------------------------------|----------|---------------------|-------------------------------------------------------------------------------------------------------------------|
|URL extraction unreliable across job boards|Medium    |High                 |Fallback to manual entry; build extraction patterns incrementally; log failures. Reuse existing fetch/clean code   |
|Email deliverability (spam folder)         |Medium    |High                 |Resend already configured; verify DKIM/SPF/DMARC on sending domain; monitor bounce rates                           |
|Users perceive emails as spam              |Low       |Medium               |Honor existing unsubscribe immediately; per-category prefs; 1 email/day max; genuine value each send               |
|AI Coach responses generic/unhelpful       |Medium    |Medium               |Constrain prompts to the user's actual pipeline; A/B test variants; thumbs up/down                                 |
|Onboarding insight cannibalizes trial/upgrade|Medium  |Medium               |Option A: fixed-cost non-gated teaser that doesn't spend trial budget; keep full Coach gated                       |
|Gmail OAuth review blocked by Google       |High      |Medium (Phase 4 only)|Defer; sensitive scope is separate from existing sign-in; consider manual forwarding interim                       |
|Scope creep across phases                  |Medium    |High                 |Ship each phase independently; measure before the next; cut Phase 4 if 1–3 hit targets                             |

-----

## 7. Open Questions

1. **~~Email provider selection~~ — RESOLVED.** Resend is already integrated and in production
   (`lib/email/client.ts`, `app/api/cron/drip-emails`). No decision needed; SES/Postmark are not on
   the table unless a future cost driver forces re-evaluation.
1. **Stale reminder threshold:** 5 days is a reasonable default. Ship fixed; make configurable later
   if users request it (small addition to `email_preferences`).
1. **~~AI Coach model for batch insights~~ — RESOLVED to provider.** Use `gpt-4o-mini` (the existing
   cost model in `lib/openai/models.ts`); there is no Anthropic/Haiku integration. Open sub-question:
   validate `gpt-4o-mini` quality is sufficient for the one-insight-per-user digest use case.
1. **AI Coach onboarding gating (Phase 3):** Option A (non-gated fixed-cost teaser, recommended) vs
   Option B (spend trial budget). Needs explicit sign-off — affects cost and upgrade dynamics.
1. **Phase 1 sequencing:** confirm the first-job step comes *after* plan selection on
   `/onboarding/welcome` so the upgrade moment isn't buried.
1. **Phase 4 prioritization:** Gmail (transformational, high-risk) vs recommendations (lower-risk,
   less differentiated). Defer until Phase 1–3 data is in.

-----

## 8. Decision Requested

Approve the phased approach and begin Phase 1. Each subsequent phase is greenlit on the measured
impact of the prior one. Note that Phase 2 is materially smaller than originally scoped because the
email engine already exists — the highest-leverage net-new work there is the **stale-application
reminder**.
