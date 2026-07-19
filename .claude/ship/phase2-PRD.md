# PRD: CareerOtter Phase 2 (Rebrand + Coaching Loop)

**Source of truth:** the owner's `~/Downloads/careerotter-phase2-prd.md` (behavior/requirements, milestones M0–M5), plus `careerotter-rfc-v2.md` (strategy), `careerotter-brand-guide-v2.md` (voice), `careerotter-decisions.md` (D1–D11), and the CareerOtter redesign (claude.ai design project `358804fe-ab31-4b58-8e72-00eba8b2fa8e` — Design System + Redesign screens) as the UI source of truth. **When PRD and redesign conflict, the PRD wins** (owner instruction). This document grounds that spec in the actual AppTrack codebase.

**Context that overrides earlier plans:** Phase 0 demand gate FAILED (1 join / 95 sent). Owner elected 2026-07-18 to build Phase 2 anyway, treating the sample as too small to trust. This supersedes the Phase 0 "do not build Phase 2 unprompted" gate and the older "CareerLift" naming (retired; brand is **CareerOtter**).

**Stack (confirmed):** Next.js 15 App Router · Supabase/Postgres · Stripe (prices in DB `subscription_plans`, not code) · Resend · PostHog (project **55190**) · Upstash rate limiting · Jest · `next.config` has `typescript.ignoreBuildErrors: true` (baseline tsc errors exist; gate = no NEW errors vs baseline).

---

## Problem Statement

AppTrack's binding constraint is **activation** — users sign up, poke around, and vanish — plus the structural churn flaw (users leave when hired). Phase 2 attacks activation directly by shipping the minimum Track it / Win it loop (log wins → get coached → build the case) and rebrands to CareerOtter so the Reddit-organic marketing has the right name to point at. Revenue target: 10 Pro subs within 60 days (from 3 today).

## Goals (owner success metrics, measured in PostHog, `filterTestAccounts: true`)

1. **Activation:** 40% of new signups complete Zero to Case.
2. **Retention:** 25% of activated users return in week 2; 15% log a win in week 3.
3. **Depth:** median 3+ wins logged in first 30 days among activated users.
4. **Revenue:** 10 total Pro subscribers within 60 days.
5. **Migration health:** zero broken roast permalinks; legacy-path 404s <1% of redirect traffic.

## Non-Goals (explicit, per PRD §3 / §8)

Browser extension, layoff-risk flags, job-listing matching, aggregate benchmarking, team/manager surface, native apps, custom promo-rubric upload (fast-follow after M4), the Reddit content program (parallel workstream). No streaks/points/gamification (D6). No proprietary-data claims (D4).

## Owner-Only Dependencies (I cannot do these; I deliver code + a checklist)

- **M0:** create/confirm the consolidated Pro $9/$90 product+prices in Stripe; archive the retired tier/prices; update the `subscription_plans` rows (`price_*`, `stripe_*_price_id`, `is_active`).
- **M1:** register + point `careerotter.io`; add domain in Vercel; set `NEXT_PUBLIC_APP_URL`/`APP_URL` per env; keep `apptrack.ing` attached for 301s; configure SPF/DKIM/DMARC on `careerotter.io` and warm up sending before M2's weekly email.
- **Copy/brand assets:** final logo/mascot SVG export per redesign (I can inline the redesign's SVG as v1).

---

## Technical Approach by Milestone

### M0 — Pricing consolidation (do first; small)
- **Entitlement collapse to one boolean.** Today gating keys off the plan-name string `"AI Coach"` across `lib/constants/permissions.ts`, `lib/utils/plan-helpers.ts`, `lib/constants/plans.ts`, and `lib/middleware/permissions.ts` (`getUserPlanInfo` already returns `{isPro, isAICoach, isFree}`). Introduce a single canonical `isPro(subscription)` — true for the new Pro plan AND grandfathered legacy paid plans (Pro + AI Coach) — and route every AI-feature gate through it. Roast stays ungated (already is; only rate-limited).
- **The line is AI.** Free = every non-model tool (unlimited tracking — remove the `FREE_MAX_APPLICATIONS=100` wall and `max_applications` enforcement — plus interview-prep templates + roast). Pro = every model-calling feature. One-time exceptions that call the model for free: the roast (existing) and the Zero-to-Case starter case (M2). Both get one pricing-page line.
- **Pricing page + copy.** Restructure `app/(app)/dashboard/upgrade/page.tsx` and marketing pricing copy around the one line; fix hardcoded/stale prices (`social-proof-bar.tsx`, `signup-page-client.tsx`, `try/*`, `trial-budget-nudge.tsx`'s stale "$10/month"). Use the design-system pricing card (Free / Pro $9·$90).
- **Webhook.** `app/api/stripe/webhook/route.ts` maps Stripe price-ID→plan against `subscription_plans`; re-point to the new IDs after the owner creates them. `mapStripeStatus` already fail-closes.
- **Acceptance:** a new user can subscribe monthly/annual at the new prices; a free user hits exactly one kind of wall (an AI feature) and never a tracking limit.

### M1 — Rebrand migration
- **Single source of truth for the domain.** Consolidate `lib/constants/site-config.ts` + divergent `config/site.json` into one env-driven origin (`NEXT_PUBLIC_APP_URL`), and replace the ~40 hardcoded `apptrack.ing` occurrences (metadata, robots, sitemap, OG routes, roast/try layouts, legal copy, email from/reply-to). Enumerated list lives in TASKS.
- **301s + permalink preservation.** Add `redirects()` in `next.config.mjs` (none today) for page-for-page; ensure roast permalinks `/roast/{id}` resolve on the new host and their OG URLs point to `careerotter.io`. **CI test** asserts `apptrack.ing/roast/:id → careerotter.io/roast/:id` (301, permanent). Redirected roast visitors see one line: "AppTrack is now CareerOtter. Same roast, new name." (already in the redesign roast screen).
- **Strings/emails/meta/share cards** say CareerOtter; "AppTrack" survives only in redirects. Email sender → `jordan@careerotter.io` after one rename note (owner sends).
- **PostHog:** keep event names stable; add a `brand_migration` property only if an event must change.
- **Brand assets:** ship the redesign's inline otter SVG + `CareerOtter` wordmark (Space Grotesk); one mascot pose only (production bar).
- **Acceptance:** every old URL in the top-50 inbound (PostHog referrers) resolves to the right CareerOtter page; roast share cards render the new brand.

### M2 — The evidence loop (the activation bet; greenfield; most protected time)
Ship as one milestone (each piece inert alone). New migration `032_careerotter_evidence.sql`:
- `career_profiles` (or column-extend `profiles`): `mode` (promotion|raise|job_search), `role`, `level`, `time_in_role`, `target`, `review_date`, onboarding state. **Verify `profiles` shape in `schemas/` before choosing extend vs new table.**
- `wins` (id, user_id, text, impact_number nullable, tag enum[delivery|leadership|collaboration|craft] nullable, source, created_at, edited_at). RLS service-role; API-route access only.
- `weekly_recaps` (user_id, week, generated_text, wins_included, created_at).
- **Zero to Case** onboarding: runs right after signup; 3 questions (~2 min) — target fork (promotion/raise/job-search), role+tenure, "up to three things you shipped." AI drafts a starter case (free, once, for everyone). Skippable but quiet skip. Job-search fork routes to tracker with win-capture framing. Day-3 opt-in deeper session (email).
- **Wins tracker:** the capture bar (one line, <10s mobile, optional number + tag). Logging is free (no model call). Free users see a preview of what Pro would produce from their own wins (the upgrade surface).
- **Weekly recap:** Friday email + in-app prompt "What shipped this week?"; if wins logged, AI generates a paste-ready recap (the return hook). Quiet-week copy per brand guide. Needs the new email domain warmed (M1).
- **Review countdown + coverage meter v1:** countdown from `review_date`; coverage = tag balance across the four areas (which have wins, which are empty). No points/streaks; flat counts only. Visual per design system (coverage meter component already specced).
- **Privacy posture ships WITH M2:** encryption at rest, a plain-language data page (no training on user data; export anytime; delete means delete), one-click full export (JSON + case doc).
- **Events:** `ztc_started`, `ztc_completed`, `win_logged`, `recap_opened` + funnels (signup → ZtC complete → first win → week-2 return).
- **Acceptance:** a new Pro user reaches a generated starter case within 5 min of signup; a logged win appears in Friday's recap; PostHog funnels exist for every step.

### M3 — Coach v1
Chat grounded EXCLUSIVELY in the user's logged wins + goal + review date; if not derivable, the coach says what's missing and how to log it. Three seeded starters ("weakest part of my case?", "draft my 1:1 talking points", "am I ready to ask?"). Gap callouts = named gap + specific receipt + next action (never criticism without a next step). **Banned-construction list embedded verbatim + versioned in the system prompt** (shared prompt fragment, imported everywhere). **Eval set of 10 synthetic profiles with graded expected outputs before ship; re-run on every prompt change.** Reuse/replace the existing `career_advice` chat store as appropriate. Event: `coach_message_sent`.

### M4 — Promo case builder / export
Structured case doc from logged wins (summary, evidence by theme, quantified impact, gaps acknowledged, the ask), framed to a generic promo rubric v1 (custom-rubric upload is a fast follow). Export: clean HTML + PDF + copy-to-clipboard prose. **Voice: first person, zero otter personality — the deliverable is the user's.** Event: `case_exported`.

### M5 — Comp tracker v1
User enters own comp history (base/bonus/equity/dates), stored + charted. Market reference v1 = BLS OES + curated public aggregates by role/level, shown as a range with the source named; copy says "market data," nothing proprietary (D4). Market-vs-you delta feeds the coach. If sourcing can't support a credible range, show own history only and say why — no fabricated ranges. Event: `comp_entered`.

## Non-Functional Requirements
- **Voice enforcement:** one shared banned-construction prompt fragment imported into every model-facing prompt (coach, roast, recap, case builder, Zero-to-Case), versioned in-repo.
- **Analytics:** each milestone defines its PostHog events before build; `filterTestAccounts: true` everywhere.
- **Performance:** quick-add interactive <2s on mobile; case generation <30s with a progress state.
- **Privacy:** ships with M2, not after.

## Sequencing
M0 + M1 first (small, unblock marketing) — but both gate on owner live-config, so I build their CODE and hand a checklist. M2 is the bet and can proceed in full regardless of M0/M1 go-live (it only needs the new email domain for the *weekly* recap). M3 follows M2 without a gate; M4, M5 deepen. **If time compresses, cut from the bottom (M5, then M4), never M2.**

## Risks (per PRD §7)
- **Conversion:** logging is free; revenue depends on free users wanting the AI layer on their own data. Counter = preview-of-your-own-case upgrade surface; watch `win_logged → upgrade`.
- **Recap deliverability:** new domain needs SPF/DKIM/DMARC + warmup before M2 weekly email.
- **Coach quality:** generic coach kills the premise; the eval set is not optional.
- **Solo bandwidth:** five milestones ≈ a quarter; protect M2.
