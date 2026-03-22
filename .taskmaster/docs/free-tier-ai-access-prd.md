# PRD: Free Tier AI Tool Access

**AppTrack AI Coach — Free Trial Redesign**

| | |
|---|---|
| **Status** | Ready for Development |
| **Author** | Jordan Lamoreaux |
| **Date** | March 21, 2026 |

---

## Background

AppTrack originally had no AI tool access for free users — AI Coach was Pro-only. That changed to give free users limited daily access as a trial. The daily limit creates a poor experience: it's time-based instead of value-based, users can trickle through indefinitely without ever feeling the ceiling, and it doesn't create a natural upgrade moment.

## Problem

- Job searching is episodic. A daily limit is arbitrary — users don't apply to jobs every day.
- A user can come back 30 days in a row, use one analysis each time, and never feel motivated to upgrade.
- The upgrade prompt fires at a random point in their day, not at a high-intent moment.
- There's no clear free tier story. "Once a day forever" is not compelling.

## Goal

Give free users enough access to understand the value of AI tools across the full product surface, then hit a clear, well-timed wall that converts them to Pro.

## Proposal

Replace the daily limit with a **one-time fixed budget**: free users get **5 AI analyses total**, shared across all tools. No reset. Once they're gone, they're gone — Pro is the path forward.

### Budget Details

- **5 analyses total** — shared pool across Job Fit, Interview Prep, and Cover Letter
- **One-time budget, no reset** — this is a trial, not a permanent free tier. The budget creates finality and urgency that a recurring allowance cannot.
- **Counter is per user account, stored server-side**
- All three tools surfaced during a **required onboarding step** so users understand the full breadth before spending any budget

### Why 5 (not 3)

3 uses forces a false choice: experience one role across all tools, or one tool across three roles. Neither builds enough pattern reliance to justify $10/month. 5 allows one full-stack run (Job Fit + Interview Prep + Cover Letter on a single role) plus 2 more analyses to establish repeated value. The user should feel the loss of the tool, not just see a wall before they understood it.

### Why no annual reset

An annual reset converts a trial into a permanent free tier with a low quota. A user who didn't convert after 5 uses and 12 months will not convert after 5 more. The reset undercuts urgency and trains users to wait it out. Re-engagement is handled separately (see below).

### Re-engagement: Win-back Email, Not Free Credits

Instead of an automatic inactivity credit (which creates an abuse path where users cycle through 90-day inactive periods to get perpetual free access), send a **win-back email** to lapsed users (90+ days inactive, 0 remaining) offering a **7-day Pro trial** or a one-time discount code. This is:

- More valuable to the user than 1 free analysis
- Trackable as a campaign
- Not exploitable as an indefinite free drip
- A warmer path to conversion than a cold credit appearing in the UI

### What Counts as One Analysis

| Tool | Counts as one use when... |
|---|---|
| Job Fit | One job description submitted and result delivered |
| Interview Prep | One session started and result delivered |
| Cover Letter | One cover letter generated and result delivered |

A use is only counted when the analysis **completes successfully**. Failed or errored analyses do not decrement the counter.

---

## User Experience

### 1. Required Onboarding: Tool Discovery

**This is not optional.** Before a free user can access any AI tool, they complete a brief onboarding flow:

- A dedicated interstitial (not a dismissible tooltip) showing all three AI tools with a one-line description of each
- Clear budget framing: "You have 5 free analyses to use across any combination of tools."
- A suggested first action: "Start with Job Fit — paste a job description to see how you match."
- A "Got it" button to proceed (the only way to dismiss)

This runs once per account, on first visit to any AI tool page. It is tracked via PostHog (`ai_trial_onboarding_completed`).

### 2. Persistent Counter (always visible)

A counter sits near the submit button on every AI tool page. Always visible. No surprise walls.

> **"4 of 5 free analyses remaining"** — badge near the submit button

When budget hits 0, the submit button becomes an upgrade CTA. Users can still view past results.

### 3. Post-Result Nudge (escalating)

After each analysis completes, a dismissible banner appears below the result:

| After use | Banner copy | Format |
|---|---|---|
| 1st–3rd | "X analyses remaining — upgrade for unlimited access." | Subtle inline banner |
| 4th | "1 analysis remaining — make it count, or upgrade for unlimited." | Prominent banner |
| 5th | (see modal below) | Modal |

### 4. Last-Use Modal

After the 5th result loads, a modal appears:

> **That was your last free analysis.**
>
> You've used Job Fit, Interview Prep, and Cover Letter. Pro gives you unlimited access to all three — for $10/month.
>
> **[Upgrade to Pro]** · Maybe later

"Maybe later" dismisses the modal. Locked state is shown on next visit.

---

## Existing Users

All existing free users are migrated to a full budget of 5 uses from the migration date forward. Past usage is not counted against them. Clean slate for everyone.

---

## Upgrade Prompt Copy

| Moment | Format | Copy |
|---|---|---|
| Counter (running) | Inline badge | "X of 5 free analyses remaining" |
| Post-result (1st–3rd) | Dismissible banner | "X analyses remaining — upgrade for unlimited." |
| Post-result (4th) | Prominent banner | "1 analysis remaining — make it count, or upgrade for unlimited." |
| Last result | Modal | "That was your last free analysis. Pro gives you unlimited access — $10/month." |
| Submit blocked (0 left) | Button state | "Upgrade to unlock" |

---

## Implementation Notes

### Schema Changes

Add to `profiles` table:

- `ai_analyses_used` (integer, default 0) — number of analyses consumed
- `ai_trial_onboarding_completed` (boolean, default false) — whether onboarding flow was shown

No reset date column needed — budget does not reset.

### Server-Side Budget Enforcement

**Use atomic check-and-decrement to prevent concurrency exploits.**

The budget check and decrement must happen in a single transaction:

```sql
UPDATE profiles
SET ai_analyses_used = ai_analyses_used + 1
WHERE id = $user_id
  AND ai_analyses_used < 5
RETURNING ai_analyses_used;
```

If no row is returned, the budget is exhausted — return **403** with `{ error: 'trial_exhausted', analyses_used: 5, analyses_limit: 5 }`.

If the analysis subsequently fails, **refund the credit**:

```sql
UPDATE profiles
SET ai_analyses_used = GREATEST(ai_analyses_used - 1, 0)
WHERE id = $user_id;
```

This approach:
- Prevents the race condition where two concurrent submissions both pass a pre-check
- Uses optimistic decrement with refund-on-failure instead of decrement-on-completion
- Is a single atomic SQL statement, no application-level locking required

### HTTP Status Code

Use **403 Forbidden** (not 402) with a descriptive response body. 402 is reserved/non-standard and will confuse monitoring tools and HTTP client libraries.

### Win-back Email (separate implementation)

- Cron job checks for users where `ai_analyses_used >= 5` and last login > 90 days ago
- Triggers a Resend email with a 7-day Pro trial link or discount code
- Track via PostHog: `ai_trial_winback_email_sent`
- One email per user per 180-day window to avoid spam

---

## PostHog Events

| Event | When | Key Properties |
|---|---|---|
| `ai_trial_onboarding_completed` | User completes onboarding flow | — |
| `ai_trial_analysis_used` | Each successful use | `analyses_remaining`, `tool_type` |
| `ai_trial_analysis_refunded` | Analysis failed, credit returned | `tool_type`, `error_reason` |
| `ai_trial_exhausted` | Counter hits 0 | `tool_type` |
| `ai_trial_upgrade_modal_shown` | Last-use modal displayed | — |
| `ai_trial_upgrade_clicked` | Any trial upgrade CTA clicked | `source` (banner/modal/button) |
| `ai_trial_winback_email_sent` | Win-back email dispatched | `days_inactive` |
| `ai_trial_winback_converted` | User upgrades via win-back link | `days_since_email` |

---

## Success Metrics

| Metric | Target |
|---|---|
| Free-to-Pro conversion rate | Baseline + 20% vs daily limit |
| `ai_trial_exhausted` -> upgrade within 7 days | > 15% |
| Median uses before upgrade | 3–4 |
| Onboarding: users who use 2+ distinct tools | > 50% |
| Win-back email -> Pro conversion | > 5% |

---

## Out of Scope

- Per-tool budgets (shared pool only)
- Changing Pro tier limits (unlimited stays unlimited)
- The unauthenticated `/try/` tools — those remain open
- Annual or periodic budget resets
- Automatic inactivity credits

---

## Key Decisions Log

| Decision | Rationale |
|---|---|
| 5 uses, not 3 | Allows one full-stack run (all 3 tools on one role) + 2 more. Users need enough exposure to feel the loss. |
| No annual reset | A trial should end. Resets convert a trial into a permanent free tier and undercut conversion urgency. |
| Win-back email instead of inactivity credit | Credits are exploitable (cycle through 90-day inactive periods). Emails are trackable, more valuable, and don't leak free usage. |
| Atomic decrement, not post-completion | Prevents race condition where concurrent submissions bypass the budget check. Refund on failure is simpler than locking. |
| 403, not 402 | 402 is reserved/non-standard. 403 is universally understood by clients and monitoring. |
| Required onboarding, not dismissible | The strategy assumes users know all three tools exist. If onboarding is skippable, users burn all uses on Job Fit. |
