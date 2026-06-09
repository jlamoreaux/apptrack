# Retention Strategy — Implementation Tasks

Source of truth: `docs/design-proposals/retention-strategy-prd.md`
Stack: Next.js 15 / Vercel · Supabase/Postgres · Vercel Cron · OpenAI (`gpt-4o-mini`) · Resend · Upstash

Note: Phase 2a (signup → free-users drip enrollment) is ALREADY wired in
`lib/services/on-signup.service.ts` → `scheduleDripSequence`. Not re-built here.

## Ordered tasks (each with tests)

- [x] T1 — DB migration `schemas/migrations/029_retention_email_preferences.sql`
      `email_preferences` table (RLS owner-select + service-role-all); add `opened_at`/`clicked_at`
      to `drip_emails`. (no code deps)
- [x] T2 — Analytics events in `lib/analytics/conversion-events.ts`
      onboarding import, email lifecycle, AI coach onboarding events + properties.
- [x] T3 — Email preferences service `lib/email/preferences.ts`
      defaults-on, get/update by userId, `canSendCategory(userId, category)`. Test: defaults + flags.
- [x] T4 — Phase 1 extraction `lib/onboarding/job-extraction.ts` + route
      `app/api/onboarding/extract-job/route.ts` (authed, NOT gated, 5/user/hr Upstash). Structured
      JSON via gpt-4o-mini. Test: response parsing/validation + URL guard.
- [x] T5 — Phase 3 insight `lib/ai-coach/onboarding-insight.ts` + route
      `app/api/onboarding/coach-insight/route.ts` (authed, NOT gated, no trial budget, gpt-4o-mini).
      Test: prompt/clamp behavior.
- [x] T6 — Phase 2b stale reminders: `lib/email/stale-reminders.ts` (query+group, respects prefs),
      lifecycle templates `lib/email/templates/lifecycle.ts`, cron
      `app/api/cron/stale-reminders/route.ts`, `vercel.json`. Test: terminal-state exclusion + group.
- [x] T7 — Phase 2c weekly digest: `lib/email/weekly-digest.ts` (summary + AI insight), template,
      cron `app/api/cron/weekly-digest/route.ts`, `vercel.json`. Test: summary computation.
- [x] T8 — Preferences API `app/api/email/preferences/route.ts` (GET/PUT current user); extend
      unsubscribe POST to accept optional `category`.
- [x] T9 — Phase 1 UI: first-job onboarding step component + wire into welcome flow + coach insight
      display. (visual QA flagged — cannot run app per CLAUDE.md)
- [x] T10 — Doc sweep: update PRD/RFC implementation-status notes.

## Quality gates per task
type-check (`npx tsc --noEmit`) → `jest` → new tests → review → `next lint`.
