# /try/* Email Capture During Processing PRD

## Problem

The current `/try/*` flow gates results behind a full signup wall:
1. User fills form → AI processes → results shown blurred → "Sign Up Free to Unlock" modal
2. This creates friction: users invested time filling the form and providing their resume, then hit a wall
3. We lose the lead entirely if they bounce — no email captured

## Solution

Capture email during AI processing instead of gating results after. Users provide their email while waiting for results, then see full (unblurred) output.

## Flow

```
User fills form → clicks "Generate"
        ↓
┌─────────────────────────────────┐
│  While AI processes (~15-30s):  │
│                                 │
│  "Your results are generating"  │
│  [progress indicator]           │
│                                 │
│  Enter your email to unlock     │
│  your full results:             │
│  [email input] [Submit]         │
│                                 │
│  "We'll also send you a copy"   │
└─────────────────────────────────┘
        ↓
Processing complete + email provided → show full results (no blur)
Processing complete + no email → show current SignupGate (fallback)
```

## Requirements

### Email Capture Component

Create `components/try/email-capture-gate.tsx`:
- Shows while `isLoading === true` (AI is processing)
- Email input with client-side validation (reuse `lib/email/validate.ts`)
- Block disposable emails (already handled by validate.ts)
- Submit button: "Unlock Full Results"
- Copy: "Enter your email to get your complete results. We'll also send you useful job search tips."
- Privacy note: "No spam. Unsubscribe anytime."
- Skip option: small "Skip" link (falls back to signup gate)
- On submit: POST to `/api/try/capture-email`

### API Route

Create `app/api/try/capture-email/route.ts`:
- Accepts: `{ email, source, sessionId?, firstName? }`
- Validates email server-side (reuse `validateEmail()`)
- Calls `addToAudience()` with audience: `'leads'`
- Calls `scheduleDripSequence()` with metadata: `{ source: 'try-{tool}' }`
- Returns: `{ success: true, contactId }`
- Rate limit: same IP can't submit more than 5 emails per hour

### Page Component Changes

Update all three `/try/*` page components:
- Track `emailCaptured: boolean` state
- When form submitted: set `isLoading=true`, show EmailCaptureGate alongside processing indicator
- When email captured: set `emailCaptured=true`
- When results ready:
  - If `emailCaptured` → show full results (pass `isPreview={false}` to results component)
  - If not `emailCaptured` → show current SignupGate behavior (blurred results)
- Remove "One free trial daily" from subtitle copy — replace with "Get your results in 30 seconds"

### Existing Infrastructure (reuse, don't recreate)

- `lib/email/validate.ts` — email format + disposable domain validation
- `lib/email/audiences.ts` → `addToAudience()` — Supabase + Resend sync
- `lib/email/drip-scheduler.ts` → `scheduleDripSequence()` — schedules Day 2 + Day 5 emails
- `audience_members` table — already exists, stores email + metadata
- Drip cron job — already runs every 4 hours, processes all pending drips
- Unsubscribe flow — already built with HMAC-secured links

### Copy Updates

| Location | Current | New |
|----------|---------|-----|
| /try/job-fit subtitle | "One free trial daily - Get instant insights" | "Get your job fit analysis in 30 seconds" |
| /try/cover-letter subtitle | "One free trial daily" | "Get your cover letter in 30 seconds" |
| /try/interview-prep subtitle | "One free trial daily - Get instant practice questions" | "Get personalized questions in 30 seconds" |
| Email gate heading | n/a | "Unlock your full results" |
| Email gate subtext | n/a | "Enter your email and we'll send you a copy too" |
| Email gate privacy | n/a | "No spam. Unsubscribe anytime." |

## Out of Scope

- Changing the AI processing logic
- Adding new drip email templates specific to /try/* tools (use existing lead templates)
- Rate limiting changes to the AI endpoints themselves
- Authenticated user flow (they already get full results)

## Success Metrics

- Email capture rate on /try/* pages > 40% (vs current 0% pre-signup)
- Bounce rate on results page decreases (users see full results, less frustration)
- Lead → signup conversion via drip emails tracked in PostHog
