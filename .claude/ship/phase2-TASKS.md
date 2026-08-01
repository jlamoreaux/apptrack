# Task Breakdown: CareerOtter Phase 2

Source: `.claude/ship/phase2-PRD.md` · Owner PRD: `~/Downloads/careerotter-phase2-prd.md` · Design: project `358804fe-...` (Design System + Redesign)
Gates per task: `npx tsc --noEmit` (no NEW errors vs baseline) → `pnpm test` → new-test check → `next lint`.
Legend: 🟢 = I can do in code · 🟠 = needs owner live action (Stripe/DNS/email) · 🔵 = needs a decision.

---

## M0 — Pricing consolidation

- [ ] M0.1 🟢 Add canonical `isPro(subscription)` helper (true for new Pro + grandfathered Pro/AI Coach); consolidate `isOnAICoachPlan`/`isOnProOrHigher`/`canAccessAIFeatures` in `lib/utils/plan-helpers.ts` + `lib/constants/plans.ts` (dedupe the double definitions).
- [ ] M0.2 🟢 Route every AI-feature gate through `isPro`: `lib/constants/permissions.ts` (`API_PERMISSIONS`/`UI_PERMISSIONS` keyed to `AI_COACH` today), `lib/middleware/permissions.ts`. Confirm roast stays ungated.
- [ ] M0.3 🟢 Remove the Free application cap: `PLAN_LIMITS.FREE_MAX_APPLICATIONS`, `subscription_plans.max_applications` enforcement, legacy `check_application_limit` trigger. Free = unlimited tracking.
- [ ] M0.4 🟢 Pricing page: rebuild `app/(app)/dashboard/upgrade/page.tsx` + `components/shared/plan-card.tsx` around Free / Pro ($9·$90) using the design-system pricing card. Roast listed under Free, no asterisk.
- [ ] M0.5 🟢 Fix hardcoded/stale price copy: `components/social-proof-bar.tsx:32`, `app/(marketing)/signup/signup-page-client.tsx:117,126`, `try/job-fit/page.tsx:49-50,202-203`, `components/ai-coach/trial-budget-nudge.tsx:71` ("$10/month" → $9).
- [ ] M0.6 🟠 OWNER: in Stripe, create/confirm Pro $9/$90 product+prices; archive retired tier/prices; update `subscription_plans` rows (`price_monthly/yearly`, `stripe_*_price_id`, `is_active`).
- [ ] M0.7 🟢 Webhook resolves plan by matching the Stripe price ID against the `subscription_plans` rows (the DB is the source of truth for price IDs — no hardcoded IDs in code). After the owner updates those rows (M0.6), the lookup at `app/api/stripe/webhook/route.ts:430-451,728-747` maps to Pro automatically; verify `checkout.session.completed` + `subscription.updated` classify correctly.
- [ ] M0.8 🟢 Tests: `isPro` truth table (new Pro, grandfathered, free, trialing, canceled); a free user is not blocked by any tracking limit; an AI route 403s for free and 200s for Pro.

## M1 — Rebrand migration

- [ ] M1.1 🟢 Single env-driven origin: consolidate `lib/constants/site-config.ts` + `config/site.json` behind `NEXT_PUBLIC_APP_URL`; audit `lib/metadata.ts`, `app/robots.ts`, `app/sitemap.ts`.
- [ ] M1.2 🟢 Replace ~40 hardcoded `apptrack.ing` occurrences (roast/try/OG routes, legal pages, `lib/actions/auth.ts:21`, email templates from/reply-to). Full grep list to be regenerated at build time.
- [ ] M1.3 🟢 Add `redirects()` in `next.config.mjs` (none today) for page-for-page 301s; extend `middleware.ts` if host-level handling is needed.
- [ ] M1.4 🟢 Roast permalink preservation: `/roast/{id}` (v1 `shareable_id`) + `/roast/v2/{id}` resolve on new host; OG URLs → `careerotter.io`. **CI test** asserting the 301 permalink redirect (PRD M1 acceptance).
- [ ] M1.5 🟢 Brand assets: inline redesign otter SVG + `CareerOtter` wordmark in nav/footer/OG; one mascot pose. Swap all interface strings/meta/share cards to CareerOtter.
- [ ] M1.6 🟠 OWNER: register/point `careerotter.io`; add in Vercel; set env vars per environment; keep `apptrack.ing` for 301s; SPF/DKIM/DMARC + email warmup on new domain; send the list rename note; update Reddit ad destinations only after CareerOtter pages verified.
- [ ] M1.7 🟢 PostHog: confirm event names unchanged through migration; add `brand_migration` prop only where an event must change.

## M2 — Evidence loop (Zero to Case + wins + weekly recap) — THE BET

- [ ] M2.1 🟢 Migration `032_careerotter_evidence.sql`: career profile fields (mode/role/level/target/review_date — verify `schemas/profiles.sql` for extend-vs-new-table), `wins`, `weekly_recaps`. RLS service-role; constants in `lib/constants/careerotter.ts` mirroring SQL CHECKs.
- [ ] M2.2 🟢 Shared voice fragment `lib/ai/voice-guardrails.ts` (banned-construction list, versioned) imported by every model-facing prompt.
- [ ] M2.3 🟢 Zero to Case: onboarding flow (3 questions, fork), `POST /api/careerotter/zero-to-case` → AI starter case (free once). Events `ztc_started`/`ztc_completed`.
- [ ] M2.4 🟢 Wins tracker: capture bar component + `POST/GET/PATCH/DELETE /api/wins`; free (no model). Event `win_logged`. Free-user preview-of-Pro surface.
- [ ] M2.5 🟢 Weekly recap: `app/api/cron/careerotter-recap` (Friday) + in-app prompt; AI recap when wins exist; quiet-week copy. Event `recap_opened`. Register cron in `vercel.json`.
- [ ] M2.6 🟢 Review countdown + coverage meter v1 (tag balance) on the "Today" dashboard per redesign. Flat counts only.
- [ ] M2.7 🟢 Privacy: encryption-at-rest posture, plain-language data page, one-click export (JSON + case doc).
- [ ] M2.8 🟢 Wire "Today" dashboard (redesign Screen B) — replace/augment `app/(app)/dashboard/page.tsx`; nav = Today/Wins/Comp/Coach/Review prep/Job search with review-countdown chip.
- [ ] M2.9 🟢 Tests: wins CRUD + RLS, ZtC contract + event firing, coverage calc, recap generation gating on wins, export completeness.

## M3 — Coach v1
- [ ] M3.1 🟢 Coach chat grounded only in wins/goal/review; seeded starters; gap = named gap + receipt + next action.
- [ ] M3.2 🟢 Banned-construction list in the system prompt (from M2.2 fragment), versioned.
- [ ] M3.3 🟢 Eval set: 10 synthetic profiles + graded expected outputs; runner re-run on prompt change. Event `coach_message_sent`.

## M4 — Promo case builder / export
- [ ] M4.1 🟢 Case builder from wins → structured doc (generic rubric v1); HTML + PDF + copy-to-clipboard; first-person, zero-otter voice. Event `case_exported`.

## M5 — Comp tracker v1
- [ ] M5.1 🟢 Comp history entry + chart; BLS/public market range with named source; feeds coach; no fabricated ranges. Event `comp_entered`.

## Cross-cutting
- [ ] Doc sweep: update README/docs/.env.example for new envs (`NEXT_PUBLIC_APP_URL`, email domain) once M1 lands.
- [ ] PostHog: dashboard "CareerOtter Phase 2 Activation" (activation/retention/depth/revenue funnels), project 55190.
