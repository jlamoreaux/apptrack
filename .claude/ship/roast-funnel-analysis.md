# Roast Funnel Analysis — Phase 1 baseline (2026-07-10)

Reproduced from live PostHog data (project **AppTrack.ing, id 55190** — NOT the MCP default "Default project" 473787; all insight work must target 55190). Window: last 90 days (2026-04-11 → 2026-07-10), unique persons, ordered funnel, 14-day conversion window.

## Prior art

**None.** No saved insight, dashboard, or notebook in PostHog references any roast event (searched names, descriptions, and full query JSON for `roast|resume|funnel`), and no analysis doc exists in the repo (`docs/design-proposals/resume_roast_prd.md` states only a 30% roast→signup *target*). This reproduction is the first saved analysis. Adjacent non-roast funnels: Landing → Signup (insight `1G4hgk0r`), Layoff Campaign (`31FqR9cK`), Campaign (`3w1TMZ0t`), Blog (`BknoDI06`).

## Reproduced funnel

Landing anchored on `$pageview` with `$pathname = /roast-my-resume` (the live surface — the `/roast-my-resume/v2` page has no traffic and no experiment/flag routes to it; "v2" in `app/api/roast/route.ts` is metadata normalization, not a live experiment).

| Step | Persons | Overall | Step conv. |
|---|---|---|---|
| 1. `$pageview` /roast-my-resume | 28 | 100% | — |
| 2. `roast_upload_started` | 14 | 50% | 50% |
| 3. `roast_upload_completed` | 14 | 50% | 100% |
| 4. `roast_viewed` | 14 | 50% | 100% |
| 5. `roast_signup_clicked` | 4 | 14.3% | **28.6%** |
| 6. `user_signed_up` | 3 | 10.7% | 75% |

## The P0 drop-off

**`roast_viewed` → `roast_signup_clicked`: 71.4% of result-page viewers never click signup** (14 → 4). The pipeline itself is flawless once upload starts (100% / 100% between steps 2–4), and those who click convert well (75%). The results page is where the funnel dies.

Secondary drop: landing → upload_started loses 50% (14 of 28) — the largest absolute loss; the email-required-before-value form (`app/(marketing)/roast-my-resume/page.tsx`, submit disabled without email) is the prime suspect, but it is a funnel-shape/product change and is **explicitly out of scope for Phase 1 without owner sign-off** (see PRD).

## Telemetry blackout (confirmed bugs)

`api_error`, `roast_upload_failed`, and `roast_limit_reached` have **never appeared** in PostHog. For `api_error` this is explained by a real bug: `app/api/roast/route.ts:429` references `user` declared inside the `try` — any failure throws `ReferenceError` inside the catch, killing both the `api_error` capture and the intended JSON error response. Same bug class in `app/api/roast/[id]/route.ts:91` (`id` out of scope in catch → results-fetch failures return an unhandled 500 instead of the intended response). Both fail `npx tsc --noEmit` today (shipped only because `next.config` sets `ignoreBuildErrors: true`). `roast_upload_failed`/`roast_limit_reached` are wired client-side but have simply never fired at this traffic level — cannot distinguish "no errors" from "errors invisible" until the server-side capture is fixed.

## Volume context (caveat for the 2-week delta report)

Tiny N: 28 landing visitors / 90 days; uploads fell from 4–5/week (mid-May) to ~0–1/week since June. The roast funnel produced at most 3 of 41 signups (~7%) in 90 days. A 2-week before/after conversion delta will be directionally suggestive at best; the comparison insight should accumulate until N is meaningful, and *traffic* to the roast page is a bigger lever than any conversion fix. Flagged for the owner report.

## Fix selection (feeds PRD Phase 1)

1. **Ship now (bug class, no product change):** fix all three roast catch-block/scope errors; restores error telemetry and correct error responses.
2. **Ship now (measured P0, minimal product change):** results-page signup CTA improvement — the CTA renders only for the roast creator (`isCreator`); strengthen the conversion path on the results page without changing the funnel shape (concrete change scoped in TASKS.md).
3. **Ship now (attribution):** put UTM params on the roast→signup CTA links so `user_signed_up` (which already carries UTM attribution from the `apptrack_utm` cookie) is roast-attributable with zero new plumbing.
4. **Owner decision, not shipped unilaterally:** deferring the email requirement to post-value (landing → upload drop) — funnel-shape change, recommend as a follow-up experiment.
