# Task Breakdown — CareerOtter Launch Readiness Kit

Branch: `careerotter/launch-readiness` off `main` (NOT the M0 pricing PR).
Stack: Next.js 15 App Router · TS · Jest (`pnpm test`) · `pnpm lint` · type: `npx tsc --noEmit` (no NEW errors vs baseline).

## Task 1: Shared rename copy + in-app transition banner
- [x] 1.1: Confirm `app/(app)/layout.tsx` is the sole authed shell (note fallback if multiple authed layouts).
- [x] 1.2: Create `lib/constants/rebrand.ts` — single source for headline ("AppTrack is now CareerOtter"), sub ("Same account, same data, same login"), and "Why the new name?" explainer + link.
- [x] 1.3: Build `components/rebrand-banner.tsx` (+ server eligibility wrapper). Render only when `NEXT_PUBLIC_REBRAND_BANNER==="on"` AND server-side `user.created_at < REBRAND_CUTOVER_AT` (server-only env). Mount in the authed shell. Dismissal via `localStorage` `ff:rebrand-banner-dismissed` (optimistic, client-only, never blocks render). Import copy from 1.2.
- [x] 1.4: A11y + UI: `role="status"`, real 44px `<button>` close, Esc-dismiss, focus ring, WCAG AA, no CLS (reserved-height slot), no emojis/gradient text. Emit `capturePostHogEvent("rebrand_banner_shown"/"rebrand_banner_dismissed")`.
- [x] 1.5: Write tests for Task 1 — eligibility matrix (existing+window-on → shows; new user → hidden; window off → hidden); dismissal persists across reload; copy comes from the shared constant.

## Task 2: Rename-announcement broadcast email (safe by construction)
- [x] 2.1: Confirm admin-route auth + send pattern by reading `app/api/admin/career-validation-email/route.ts` and `lib/email/broadcast.ts` (`sendBroadcast`, `getSubscribedMembers`, `AudienceId`).
- [x] 2.2: Create `lib/email/templates/rebrand-announcement.ts` — imports shared copy (1.2); plain-language; includes unsubscribe link + physical mailing address (CAN-SPAM). Sender = warmed `apptrack.ing` domain, read from constant.
- [x] 2.3: Create `app/api/admin/rebrand-email/route.ts` mirroring the existing admin-auth guard. `dryRun` default true → renders + returns audience count + optional single live test to owner, NO mass SMTP. Real send requires `NODE_ENV==="production"` AND `ALLOW_REAL_SEND==="1"` AND `confirm===true`; refuse otherwise (and always in CI/non-prod). Assert sender domain matches expected or refuse.
- [x] 2.4: Idempotency — per-recipient sent-log (marker checked before each send); re-run skips delivered addresses; batch with basic backoff; resumable via cursor. Emit `email_broadcast_sent` (count, dryRun).
- [x] 2.5: Write tests for Task 2 — dry-run sends 0 mass mail + correct count; real-send guard refuses when any of the 3 conditions missing and in CI; re-run skips already-sent; admin route rejects unauth/non-admin; template contains unsubscribe token + physical address.

## Task 3: `careerotter_evidence` flag primitive (default-off)
- [x] 3.1: Add `CAREEROTTER_EVIDENCE: "careerotter-evidence"` to `FEATURE_FLAGS` (hyphenated to match existing keys). Decide banner-window as env (chosen) — do NOT also add a banner flag.
- [x] 3.2: Single resolver used by both the client `useFeatureFlag` path and a new server helper in `lib/analytics/posthog-server.ts`; fallback `false` on undefined/error/no-user; server helper takes explicit session user id.
- [x] 3.3: Write tests for Task 3 — resolver returns `false` on undefined/error/no-user (client + server); flag key string matches the canonical constant.

## Task 4: Launch-readiness audit doc (read-only)
- [x] 4.1: Read-only query (use read-only `gh` account; NO writes/comments/resolves) of unresolved review-thread count, CI conclusion, and mergeable state for PRs #182–#191.
- [x] 4.2: Write `.claude/ship/phase2-LAUNCH-CHECKLIST.md` — header stamped with as-of commit SHA + timestamp + "re-run before go/no-go"; table of enumerable PR states; gating status (which surfaces wrapped); owner-only launch steps (domain, env, flag %, email send). No per-thread remediation.
- [x] 4.3: Validation subtask — verify the table matches live PR state at write time and that the doc makes no write to GitHub (audit is analysis; no unit test, this is the dedicated verification).

## Task 5: Doc accuracy — env vars
- [x] 5.1: Add to `.env.example` (with comments): `REBRAND_CUTOVER_AT` (server-only ISO instant), `NEXT_PUBLIC_REBRAND_BANNER` (on/off), `ALLOW_REAL_SEND` (gate for real email send). Note `FROM_EMAIL` should point at the warmed sender for the announcement.
- [x] 5.2: Validation — grep `.env.example` contains the three new keys; no other docs reference them incorrectly.

## Known owner-only (NOT in this workflow — checklist output only)
- Merge the 10 PRs (order per `phase2-ROLLOUT.md`).
- Domain/DNS/Vercel env/SPF-DKIM-DMARC + `careerotter.io` go-live.
- Flip `careerotter_evidence` rollout % in PostHog.
- Trigger the real rename email (after domain warmup).

## Known trade-offs (from code review, accepted)

- **Empty audience burns the campaign marker** (route.ts): marker-first idempotency
  means a real send fired against an empty audience records "sent" with 0 recipients and
  needs `force:true` to retry. Kept — this matches the proven `career-validation-email`
  pattern; the alternative (marker-after-send) reintroduces double-send risk. Response
  clearly shows `sent:0`.
- **`force` resend overwrites `recipient_count`/`metadata`** (route.ts): a scoped retry
  resets the analytics count. Low severity — the count is analytics-only for this
  one-time campaign, not a gate. Kept for pattern-consistency with the career route.
- **Substring sender guard** (`from.includes('apptrack.ing')`): accepts a crafted
  look-alike domain. Kept — `REBRAND_FROM` is owner-set env; there is no adversary in the
  single-operator threat model.
