# CareerOtter Phase 2 — Merge & Rollout Plan

Goal: merge 10 PRs to `main` without a big-bang, so launch day is "turn the domain
on + set one flag to 100%," and everything else has already landed dark.

## Principle: merge ≠ activate

- **Dark-merge** anything backward-compatible or inert — it lands on `main` and
  ships to prod with zero user-visible change.
- **Flag** the net-new product surfaces behind ONE product flag.
- **Cutover** the rebrand as a coordinated launch event (domain + deploy), NOT a
  per-user flag — a half-flagged brand is incoherent.
- Don't flag billing or brand. Flags are code you must test on both sides and clean
  up; only flag what de-risks launch.

## Flag inventory

- `careerotter-evidence` (PostHog, add to `FEATURE_FLAGS`) — gates every net-new
  surface: M2b evidence UI, M3 coach, M4 case builder, M5 comp, M2c Zero-to-Case
  onboarding, and the M7 nav entries that point at them. This is THE switch.
  - Client `useFeatureFlag` hides UI. The real access boundary stays `isPro()`
    server-side for AI features — keep it; the flag is for surfacing, not security.
  - localStorage override (`ff:careerotter-evidence`) already lets you dogfood locally.
- No flag for M0 pricing, M1 rebrand, M2a data, M6 visual (see below).

## PR disposition

| PR | Milestone | Disposition | Why |
|----|-----------|-------------|-----|
| #182 | M0 pricing | **Dark-merge, live** | `isPro` grandfathers everyone; pricing page is brand-neutral and reflects the now-live $9/$90. DB repriced (done). |
| #184 | M2a evidence data/API | **Dark-merge** | Inert — new tables/routes with no entry point. |
| #185 | M2b evidence UI | **Flag** `careerotter-evidence` | Net-new surface. Stacked on M2a. |
| #186 | M3 coach | **Flag** | Net-new surface. Stacked on M2a. |
| #187 | M4 case builder | **Flag** | Net-new surface. Stacked on M2a. |
| #188 | M5 comp tracker | **Flag** | Net-new surface. Stacked on M2a. |
| #189 | M2c ZtC/recap/privacy | **Flag** (cron/privacy page can be live) | Onboarding surface behind flag; recap cron + privacy page are safe live. |
| #190 | M6 visual identity | **Dark-merge or cutover** | Global theme; cosmetic. Ship when brand cutover lands, or earlier if standalone. |
| #191 | M7 nav/IA | **Flag** (couple to `careerotter-evidence`) | New nav must only expose surfaces that are on. |
| #183 | M1 rebrand | **CUTOVER (last)** | Domain/env/OG/sitemap/email/301s are deploy-time. Launch-day event. |

## Merge order

1. **#182 M0** → `main`. Ships live; grandfathers all. (DB reprice already applied.)
2. **#184 M2a** → `main`. Dark/inert.
3. Add `careerotter-evidence` to `FEATURE_FLAGS`; wrap entry points as each lands.
4. **#185 / #186 / #187 / #188 / #189** → `main`, in stack order, all flagged OFF.
5. **#190 M6** visual → `main` (with or just before the cutover).
6. **#191 M7** nav → `main`, gated by the same flag.
7. **#183 M1 rebrand** → `main` last, held for launch day.

By step 6, ~everything is on `main` and in prod, invisible. Launch = flip the domain
+ set the `careerotter-evidence` flag to 100%.

## Launch day

1. Deploy the rebrand cutover (domain live, env vars set, 301s from apptrack.ing).
2. Verify: old URLs 301 correctly, roast permalinks + OG on new host, and general
   transactional email sends from the new careerotter.io domain.
3. Send the rename announcement (`POST /api/admin/rebrand-email`, dry-run → test →
   `confirm`). NOTE: this one email deliberately sends from the **warmed apptrack.ing**
   domain, not careerotter.io — announcing a domain change from a cold domain tanks
   deliverability. Migrating this campaign's sender to careerotter.io is a separate,
   later step once the new domain is warmed.
4. Set `careerotter-evidence` to 100% (or ramp: 10% → 50% → 100% watching PostHog
   funnels: signup → ZtC complete → first win → week-2 return).
5. Confirm a fresh signup hits Zero-to-Case and the new surfaces.

## Post-launch cleanup

- Once `careerotter-evidence` is 100% and stable, remove the flag checks and the
  dead branches (both sides of every `useFeatureFlag`).
- Archive the retired Stripe product/prices after the transition (owner).
- Later: the deferred `AI Coach -> "Pro"` DB rename + move display constants off the
  `AI_COACH` keys (not required for launch; `isPro` is name-agnostic).

## Open risks

- **Stacked PRs (#185–189 on M2a):** merge M2a first, then the stack in order, or
  collapse via the integration branch. Resolve conflicts against the M2a that lands.
- **New API routes without server-side flagging** are reachable by URL even when the
  UI is hidden. Fine for soft launch (AI routes still gate on `isPro`); add
  server-side flag checks (`posthog-server.ts`) only if you need hard gating.
