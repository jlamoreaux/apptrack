# Roast Funnel Fix — Before/After Conversion Delta Report

**Owner-facing.** Baseline is filled from `.claude/ship/roast-funnel-analysis.md`. The post-fix column is completed ~2 weeks after the fix ships, from the paired PostHog insights (project **55190**) linked below. This is a repair, not an experiment — the bar is "measurably better," not a threshold.

## What shipped (fix date: __________)

1. **Telemetry restored** — hoisted `user`/`id` out of the `try` blocks in `app/api/roast/route.ts` and `app/api/roast/[id]/route.ts`, so the catch handlers no longer throw a `ReferenceError`. `api_error` events now actually fire (they had *never* appeared in PostHog before), and failed roasts return the designed JSON error instead of a generic network failure.
2. **Results-page conversion module** — the signup CTA on the roast results page was a dead-end footer button; it's now a value-forward module (benefit bullets + primary CTA) placed directly after the score, with a secondary CTA at page end. Targets the measured P0.
3. **Attribution** — roast → signup CTA links now carry `utm_source=roast&utm_medium=results_page&utm_campaign=roast_funnel`, and `useUTMTracking()` is now actually mounted on the signup page (it previously wasn't mounted anywhere, so the `apptrack_utm` cookie was never written — historical `user_signed_up` UTM fields were null via this path).
4. **Instrumentation** — added `roast_file_selected` (landing-form abandonment is now visible) and registered `roast_try_another` as a named event.

## Baseline (90 days: 2026-04-11 → 2026-07-10, unique persons, ordered, 14-day window)

| Step | Persons | Overall conv. | Step conv. |
|---|---|---|---|
| `$pageview` /roast-my-resume | 28 | 100% | — |
| `roast_upload_started` | 14 | 50% | 50% |
| `roast_upload_completed` | 14 | 50% | 100% |
| `roast_viewed` | 14 | 50% | 100% |
| `roast_signup_clicked` | 4 | 14.3% | **28.6%** |
| `user_signed_up` | 3 | 10.7% | 75% |

**Measured P0:** `roast_viewed → roast_signup_clicked` = 28.6% step conversion (71.4% of result-page viewers never click signup). This is the number the fix targets.

## Post-fix (fill after ~2 weeks: __________ → __________)

| Step | Persons | Overall conv. | Step conv. | Δ step conv. vs baseline |
|---|---|---|---|---|
| `$pageview` /roast-my-resume | | | — | — |
| `roast_upload_started` | | | | |
| `roast_upload_completed` | | | | |
| `roast_viewed` | | | | |
| `roast_signup_clicked` | | | | **← the P0 metric** |
| `user_signed_up` | | | | |

**Headline number to report:** post-fix `roast_viewed → roast_signup_clicked` step conversion vs. the 28.6% baseline.

## Caveats (read before drawing conclusions)

- **Tiny N.** Baseline is 28 landing visitors over 90 days; uploads fell to ~0–1/week since June. Two weeks may not accumulate enough sessions for a stable rate — **let the post-fix window run until N is comparable** (aim for ≥25 `roast_viewed` persons) rather than forcing a 2-week readout.
- **Traffic is the bigger lever.** The roast funnel produced at most 3 of 41 signups (~7%) in 90 days. Even a large conversion lift on tiny traffic is a small absolute gain; driving traffic to `/roast-my-resume` will move more than this fix.
- **Telemetry discontinuity.** `api_error` and `roast_file_selected` had zero history pre-fix by construction (the bug / the missing instrumentation). Their post-fix counts are new signal, not a delta.

## PostHog artifacts (project 55190)

- Pre-fix funnel insight (fixed 2026-04-11 → 2026-07-10): https://us.posthog.com/project/55190/insights/UIWaAveg
- Post-fix funnel insight (rolling; retarget `date_from` to the true fix date): https://us.posthog.com/project/55190/insights/cND1WTSY
- Ship-date annotation: id 356388 (2026-07-10)
- Companion gate dashboard: https://us.posthog.com/project/55190/dashboard/1829895

Verification at creation: the pre-fix funnel reproduced the baseline exactly (28 → 14 → 14 → 14 → 4 → 3; the 28.6% P0 step confirmed).
