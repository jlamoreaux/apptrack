# AI Coach job-fit tab — `TypeError: $ is not a function` on click

## Status
Resolved (2026-05-28). Root cause identified from the PostHog session below; fix shipped along with
an in-app support form and app-wide error boundaries. See "Resolution" at the bottom.

> Note: the title says "job-fit tab", but the crash was actually on the **Advice** tab. The exception
> `$current_url` read `tab=job-fit` because the tab switch updates React state immediately while the
> URL query param lags — the rendered component when it crashed was the Advice chat.

## PostHog references
- Error tracking issue: `019e6fb9-b0c2-74f2-bb76-183fa419c871`
- Example session: `019e6fac-b613-7a65-8e73-f9f77ba26ccf`
- Example person (paying user): `2155c5d7-234e-5e1c-a6ee-50be99dbe97d` (distinct_id `019e6fac-b616-7c4a-be40-a377df6c8350`)
- Vercel deployment ID at time of crash: `dpl_3taUfhvBMFATmhmLQpuuVhzW9MJ3`

## What happens
On `/dashboard/ai-coach?tab=job-fit&applicationId=…`, clicking a button in the job-fit tab throws an unhandled `TypeError: $ is not a function`. The user clicked once, got no visible response, then rage-clicked — PostHog captured a `$rageclick` and ~10 identical exceptions fired in roughly one second. The user then navigated away from AI Coach back to the application detail page.

## Stack (mangled — sourcemaps missing)
Top frame is `onClick` in:
```text
/_next/static/chunks/app/(app)/dashboard/ai-coach/page-85fa627d3bb58727.js
```
Calls into shared chunk `/_next/static/chunks/5bfbefed-7fac4e9d5299b08f.js` at functions `iG → ? → nS → i4 → ce → s9`.

Exception list:
```json
{ "type": "TypeError", "value": "$ is not a function", "mechanism": { "handled": false } }
```

## Why we can't see the real symbol
PostHog reports `Could not find sourcemap for source url` for both `5bfbefed-…js` and the ai-coach page chunk for deployment `dpl_3taUfhvBMFATmhmLQpuuVhzW9MJ3`. Sourcemap upload to PostHog is either not running or not running for this build. Until that's fixed, `$` is just a mangled name — could be jQuery, a lodash/utility shorthand, a tree-shaken default export, or an unresolved dynamic import.

## Likely causes to investigate
1. A utility imported as `$` (e.g. a chart, parser, or fetch helper) is `undefined` at runtime — tree-shaking or a wrong named-vs-default import after a recent change to the job-fit tab.
2. A library expected on `window.$` (jQuery-style) is not loaded on this route.
3. A conditional/dynamic import resolves to `undefined` and is then called.

## User impact
This user had just paid (Stripe live session `cs_live_b1ZCxC2DwEMh4Hdcbv8ToVdiKQKiHQ05pyC22kS3VIDTaokU2y80pQBv58`) and was on their first real use of AI Coach. They hit the bug ~10 minutes after upgrading. This is a churn risk on the feature people are paying for.

Feature flags on the affected session:
- `conversion-hero-copy=control`
- `dashboard-ux-audit-v1=true`
- `show-testimonials=false`

## Suggested next steps
1. Upload sourcemaps for `dpl_3taUfhvBMFATmhmLQpuuVhzW9MJ3` (or wire sourcemap upload into the Vercel build) so the issue resolves to a real symbol and line.
2. Re-open `/dashboard/ai-coach?tab=job-fit&applicationId=…` against a recent application and click through every button on the job-fit tab — the offending handler is in `app/(app)/dashboard/ai-coach/page.tsx` or one of its imports.
3. Watch session `019e6fac-b613-7a65-8e73-f9f77ba26ccf` in PostHog to see which button the user clicked.
4. Once identified, check recent git history on the job-fit tab for an import that changed shape (default → named, or removed).

---

## Resolution (2026-05-28)

### Confirmed root cause
The clicked element was the **chat "Retry" button on the AI Coach → Advice tab**, not the job-fit
tab. PostHog autocapture shows the `$el_text` on every exception (and the `$rageclick`) was `Retry`;
the user had submitted a chat message that errored, which renders the error UI's Retry button.

`components/ai-coach/career-advice.tsx` destructured `reload` from `useChat` and called it in the
Retry handler:
```tsx
const { ..., reload, ... } = useChat({ ... });
// ...
<Button onClick={() => reload()}>Retry</Button>
```
The project runs `@ai-sdk/react@3` / `ai@6`, where `useChat`'s `reload` was **removed and replaced by
`regenerate`** (verified in the installed SDK type defs and `AbstractChat.regenerate` source). So
`reload` was `undefined`, and clicking Retry called `undefined()` → `TypeError: reload is not a
function`, minified to `$ is not a function`. It was the only `reload` usage in the app.

### Fix
- `career-advice.tsx`: destructure `regenerate` and `clearError` instead of `reload`; the Retry
  handler now clears the stale error banner and re-fires the failed request via `regenerate()`
  (verified to re-submit from the last user message in the error state). Emits an
  `ai_chat_retry_clicked` analytics event with the outcome.

### Shipped alongside (hardening so a future crash isn't a dead end)
- **In-app support form** emailing `support@apptrack.ing` (reply-to = the user): `POST /api/support`
  (auth + validation + rate limit + HTML-escaped body via the shared Resend `sendEmail` helper), a
  shared `SupportForm`, a `SupportDialog` wired into the desktop user menu and mobile nav, and a
  standalone `/dashboard/support` page.
- **Error boundaries**: a shared accessible `SupportErrorFallback` (recovery action + "Contact
  support" link, fires an `error_boundary_triggered` event); each of the five AI Coach tabs wrapped
  in `SectionErrorBoundary`; `ApplicationAIAnalysis` wrapped; plus route-level `app/(app)/error.tsx`
  and last-resort `app/global-error.tsx` (which previously did not exist anywhere in the app).

### Still open (separate from this fix)
- PostHog **sourcemap upload** for production builds is still not running, which is why this issue
  resolved only to the mangled symbol `$`. Worth wiring into the Vercel build so future exceptions
  resolve to real symbols/lines. (Original suggested step 1 below.)
