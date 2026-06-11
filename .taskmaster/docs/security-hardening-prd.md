# PRD: Security Hardening

**AppTrack — Remediation of Codebase Security Audit Findings**

| | |
|---|---|
| **Status** | Ready for Development |
| **Author** | Jordan Lamoreaux |
| **Date** | June 11, 2026 |
| **Scope** | Database RLS, payment/promo bypass integrity, API authorization, secrets, and hardening |

---

## Background

A full defensive security audit of the AppTrack codebase (API authorization, auth/middleware/admin, Stripe/payments, file uploads & AI endpoints, database RLS, and secrets/config) plus a focused review of the custom Stripe-bypassing promo-code system surfaced a set of vulnerabilities ranging from Critical to Low. The application is generally well-built — Zod validation, ownership-scoped queries, Stripe webhook signature verification, magic-byte file validation, and consistent admin gating are already in place — but several issues allow cross-user data access, unauthorized entitlement grants, and abuse of the promo system.

The single most important architectural fact driving severity: `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design. Any authenticated user can query PostgREST directly with their JWT, so **Row Level Security is the only enforcement boundary at the data layer**. Where RLS is missing or permissive, application-layer authorization elsewhere does not protect the data.

## Problem

1. **Data-layer exposure.** Several tables holding user PII and AI analysis content either have no RLS or have policies that defeat RLS entirely, allowing any authenticated user to read or modify other users' data — including subscription status.
2. **Payment bypass integrity.** The custom promo-code system (which grants paid entitlements without Stripe) has gaps that let a single code be redeemed repeatedly, defeat usage caps, and grant permanent top-tier access.
3. **Endpoint trust boundaries.** A few endpoints accept identifiers or fields without verifying ownership, validate input, or rate-limit expensive/unauthenticated operations; one fetches arbitrary user-supplied URLs (SSRF).
4. **Secrets & tokens.** Forgeable tokens via hardcoded fallback secrets, and missing transport/security headers.

## Goal

Close every identified vulnerability with verifiable acceptance criteria, prioritizing the issues that expose user data or grant free paid access. Establish regression tests (especially RLS cross-user tests) so these classes of bug cannot silently return.

## Non-Goals

- Re-architecting the subscription or AI-Coach systems beyond what is required to close the findings.
- Migrating away from Supabase, Stripe, or the existing rate-limiting infrastructure.
- Penetration testing of third-party services.

---

## Findings Summary

| ID | Severity | Area | Issue | Primary location |
|---|---|---|---|---|
| DB-1 | Critical | Database | `FOR ALL USING(true)` policies defeat RLS on `profiles`, `user_subscriptions`, `usage_tracking` | `scripts/022-fix-rls-for-triggers.sql:18-48` |
| DB-2 | Critical | Database | No RLS enabled / no policies on `resume_analysis`, `interview_prep`, `application_history` | `schemas/resume_analysis.sql`, `schemas/interview_prep.sql`, `schemas/application_history.sql` |
| PROMO-1 | Critical | Promo | Cross-endpoint double-redemption of `trial` codes (separate dedup tables) | `app/api/stripe/apply-free-code/route.ts`, `app/api/promo/activate-trial/route.ts` |
| PROMO-2 | Critical | Promo | `used_count` UPDATE silently blocked by RLS → `max_uses` unenforced | `app/api/stripe/apply-free-code/route.ts:303-309` |
| AI-1 | High | AI | SSRF: server fetches arbitrary user-supplied URL with no host filtering/timeout | `app/api/ai-coach/fetch-job-description/route.ts:57` |
| API-1 | High | API | Preview-session hijack: session loaded by id with no ownership check, then decrypted/claimed | `app/api/try/convert-session/route.ts:41-80` |
| API-2 | High | API | Unauthenticated, unrate-limited email-unlock returns AI content via service-role client | `app/api/try/unlock-with-email/route.ts` |
| PROMO-3 | High | Promo | TOCTOU race + no `UNIQUE(user_id, code)` on `promo_code_usage` | `scripts/027-promo-code-usage-table.sql` |
| PROMO-4 | High | Promo | `trial` code can grant permanent, top-tier access (null period_end, plan defaults to AI Coach) | `app/api/stripe/apply-free-code/route.ts:168, 196-209` |
| DB-3 | High | Database | `SECURITY DEFINER` funcs trust caller-supplied tier; no `search_path` set | `schemas/pre-registration-ai-features.sql:115`, `schemas/migrations/026_*.sql:33` |
| API-3 | High | API | Mass assignment: `...body` spread into admin announcement UPDATE (RLS-bypassing client) | `app/api/admin/announcements/[id]/route.ts:54` |
| SEC-1 | High | Secrets | Forgeable unsubscribe tokens via hardcoded fallback secret | `app/api/email/unsubscribe/route.ts:9`, `lib/email/drip-scheduler.ts` |
| CFG-1 | High | Config | No CSP / X-Frame-Options / HSTS / nosniff; `ignoreBuildErrors` + `ignoreDuringBuilds` | `next.config.mjs` |
| PAY-1 | Medium | Payments | Downgrade treats `findByUserId()` array as single object; ownership re-check missing | `app/api/stripe/downgrade/route.ts:78` |
| AI-2 | Medium | AI | AI output interpolated into PDF HTML without escaping | `app/api/ai-coach/generate-pdf/route.ts:~310` |
| PROMO-5 | Medium | Promo | No rate limiting on `validate-promo`, `apply-free-code`, `activate-trial` (enumeration) | promo endpoints |
| PROMO-8 | Medium | Promo | Cancels paid Stripe sub without confirmation; proceeds even if cancel fails | `app/api/stripe/apply-free-code/route.ts:144-165` |
| DB-4 | Medium | Database | `admin_users` missing UPDATE policy / `WITH CHECK` | `schemas/admin_users.sql:31-39` |
| SEC-2 | Medium | Secrets | Cron secret fallback / undefined-compare; hardcoded fallback admin UUID | `app/api/cron/*`, `lib/services/admin.service.ts:133` |
| CFG-2 | Medium | Config | In-memory rate limiter is per-instance; some hot endpoints bypass Redis limiter | `lib/utils/rate-limiting.ts` |
| AI-3 | Medium | AI | DOCX parsing has no decompression/timeout guard (zip-bomb DoS) | `app/api/resume/upload/route.ts` |
| AI-4 | Medium | AI | Email header injection risk via unvalidated `replyTo` | `app/api/support/route.ts:~249` |
| AUTH-1 | Medium | Auth | Rate-limit key trusts spoofable `X-Forwarded-For` first value | `app/api/auth/validate/route.ts` |
| PROMO-6 | Low | Promo | `premium_free` not in DB `code_type` CHECK constraint (dead/unstorable) | `scripts/028-promo-codes-free-forever.sql:3-4` |
| PROMO-7 | Low | Promo | `valid_from`/`valid_until` defined in types/admin form but never enforced | `types/promo-codes.ts:40-41` |
| AI-5 | Low | AI | `ReactMarkdown` renders AI content without explicit `rehype-sanitize` chain | `components/ai-coach/shared/MarkdownOutput.tsx` |
| AUTH-2 | Low | Auth | Service-role DAL methods rely on callers always gating with admin checks | `lib/dal/users.dal.ts:40-73` |
| CFG-3 | Low | Config | `"latest"` version pinning for ~25 deps (supply-chain risk) | `package.json` |
| OPS-1 | Low | Process | RLS defined in `scripts/` not mirrored in `schemas/` (drift/ordering risk) | `scripts/` vs `schemas/` |

---

## Technical Approach by Phase

Phases are ordered by dependency and blast radius. Phase 0 and Phase 1 close the issues that directly expose user data or grant free paid access and should ship first. All schema changes are delivered as numbered migrations in `schemas/migrations/` and applied via `./scripts/run-schema.sh`; RLS is also mirrored into `schemas/` to resolve the drift (OPS-1).

### Phase 0 — Data-Layer Lockdown (Critical, blocking)

**DB-1: Remove RLS-defeating policies.**
- Drop `"Trigger functions can manage profiles"`, `"...subscriptions"`, `"...usage"` (`FOR ALL USING(true) WITH CHECK(true)`). These are unnecessary: `SECURITY DEFINER` trigger functions already run as table owner and bypass RLS.
- Verify the `handle_new_user` and related trigger functions are `SECURITY DEFINER` with `SET search_path = public, pg_temp`; if any rely on the dropped policies, fix the function rather than re-adding a wildcard policy.
- **Acceptance:** A standard authenticated user (anon-key JWT) attempting `select`/`update` on another user's `profiles`, `user_subscriptions`, or `usage_tracking` row returns zero rows / permission denied. Self-rows still work. New-user signup still provisions a profile + free subscription.

**DB-2: Enable RLS and add owner policies on the three exposed tables.**
- `resume_analysis`, `interview_prep`: `ENABLE ROW LEVEL SECURITY`; SELECT/INSERT/UPDATE/DELETE policies scoped `auth.uid() = user_id`.
- `application_history`: scope through parent — `EXISTS (SELECT 1 FROM applications WHERE id = application_history.application_id AND user_id = auth.uid())`.
- **Acceptance:** Cross-user `select *` on each table returns zero rows for a non-owner; owner access and existing app flows unaffected.

**DB-3: Harden `SECURITY DEFINER` functions.**
- `check_ai_feature_allowance` (and the 026 migration variant) must derive the user's tier from the database (looked up by `user_id`), not from a caller-supplied `p_subscription_tier` parameter. If the parameter must remain for compatibility, validate it against the DB value and reject mismatches.
- Add `SET search_path = public, pg_temp` to every `SECURITY DEFINER` function (`check_ai_feature_allowance`, `cleanup_*`, `get_ai_usage_count`, `get_user_ai_limits`, `increment_*`, `handle_new_user`, trial-budget functions).
- **Acceptance:** A free-tier user cannot obtain an allowance by passing an elevated tier; `\df+` shows non-empty `search_path` config on all definer functions.

**DB-4: `admin_users` UPDATE policy.**
- Add `FOR UPDATE USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()))` (or equivalent existence check), preserving the existing "cannot modify self into/out of admin" intent.
- **Acceptance:** Non-admins cannot UPDATE `admin_users`; admins can, and policy has a `WITH CHECK`.

### Phase 1 — Payment & Promo Bypass Integrity (Critical)

The promo system is the entire Stripe bypass; its integrity is treated as a payment control.

**Consolidate redemption (PROMO-1).**
- Introduce a single server-side redemption service used by both `apply-free-code` and `activate-trial`. Record every redemption in one canonical table (`promo_code_usage`) and check that one table for prior use, regardless of code type or entry point.
- Define a single "per user" rule explicitly: at most one redemption per `(user_id, code)`, and enforce the global "one trial per user" rule consistently across both paths if that remains the business intent.
- **Acceptance:** A `trial` code redeemed once via either endpoint is rejected by the other endpoint for the same user.

**Atomic, enforced usage limits (PROMO-2, PROMO-3).**
- Add `UNIQUE(user_id, code)` constraint to `promo_code_usage` (back-fill/dedup existing rows first).
- Replace the inline `used_count + 1` UPDATE with a `SECURITY DEFINER` function that increments and enforces the cap in one statement, e.g. `UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ? AND (max_uses IS NULL OR used_count < max_uses) RETURNING id`; treat zero rows returned as "limit reached." Use this in both endpoints.
- Stop ignoring the result of all usage writes (check the returned error/row count and fail the request if the write did not happen).
- Add an UPDATE policy (or rely on the definer function) so the counter actually moves — confirm `used_count` increments in practice.
- **Acceptance:** Concurrent redemption attempts (N parallel requests, single user and across users) never exceed `max_uses` and never grant a single user the same code twice; `used_count` reflects real redemptions.

**No unbounded/permanent grants (PROMO-4).**
- A missing `plan_name` must default to the **lowest** entitled plan, never "AI Coach."
- Reject any `trial` redemption that computes a null/absent `period_end`; a trial must always have a finite end date. Ensure the trial-expiry cron covers all promo-granted subscriptions.
- **Acceptance:** A misconfigured `trial` code cannot produce an `active`, never-expiring, top-tier subscription; such codes are rejected with a clear error.

**Safe handling of existing paid subscriptions (PROMO-8).**
- Do not silently cancel a paid Stripe subscription on free-code application. Either block when an active paid sub exists, or require an explicit confirmation flag in the request and only proceed if Stripe cancellation succeeds (treat cancel failure as a hard error — do not overwrite the local row while Stripe keeps billing).
- **Acceptance:** Applying a free code while on a paid plan either is blocked or requires explicit confirmation; on Stripe cancel failure the local subscription is unchanged and an error is surfaced.

**Schema/type consistency (PROMO-6, PROMO-7).**
- Decide whether `premium_free` is a supported type. If yes, widen the `code_type` CHECK constraint to include it; if no, remove it from types/code. (Currently the DB CHECK forbids it while code relies on it.)
- Either enforce `valid_from`/`valid_until` (add columns + checks to all three endpoints) or remove them from the type and admin form so the active window is unambiguous.
- **Acceptance:** Every `code_type` the code can emit is storable; the admin-configured validity window is actually enforced (or removed).

**PAY-1: Downgrade correctness.**
- Use `getCurrentSubscription()` (returns a single record or null) instead of `findByUserId()` (array) in `app/api/stripe/downgrade/route.ts`; add an explicit `subscription.user_id === user.id` ownership check before mutating.
- **Acceptance:** Downgrade validation guards fire correctly; a user can only downgrade their own subscription.

### Phase 2 — Endpoint Authorization, IDOR & SSRF (High)

**AI-1: SSRF protection on job-description fetch.**
- Before fetching, resolve the hostname and reject private/loopback/link-local/metadata ranges (RFC1918, `127.0.0.0/8`, `169.254.0.0/16`, `::1`, `fc00::/7`, cloud metadata `169.254.169.254`). Allow only `http`/`https`. Disable or re-validate redirects (re-check each hop against the blocklist). Add a short timeout (e.g. 5s) and a response-size cap.
- **Acceptance:** Requests to internal/metadata addresses (directly or via redirect) are rejected; legitimate public job URLs still fetch; requests time out rather than hang.

**API-1: Preview-session ownership.**
- Tie `ai_preview_sessions` to a creator (anonymous owner token and/or `user_id`) and verify ownership before decrypting/returning content and before converting. Enforce `expires_at` at decrypt time.
- **Acceptance:** A user cannot decrypt or claim a session they did not create; expired sessions are rejected.

**API-2: Rate-limit and tighten email-unlock.**
- Add Upstash rate limiting keyed on `sessionId` + email + IP. Enforce `expires_at`. Keep the service-role usage minimal and scoped.
- **Acceptance:** Brute-forcing session/email combinations is throttled; expired sessions cannot be unlocked.

**API-3: Eliminate mass assignment in admin announcements.**
- Replace `...body` spread with a Zod schema whitelisting only editable fields, matching the pattern used by other routes (`ApplicationUpdateSchema`, etc.). Route admin announcement writes through `requireAdmin()` from `lib/auth/admin-guard.ts`.
- **Acceptance:** Unknown fields in the request body are ignored/rejected; only whitelisted columns can be updated.

**AUTH-1: Trustworthy client IP for rate limiting.**
- Derive client IP from the platform-provided trusted header per the known proxy depth rather than the first `X-Forwarded-For` value; consider per-token limits in addition to per-IP.
- **Acceptance:** Spoofing `X-Forwarded-For` does not reset/evade the rate limit.

**AUTH-2: Contain service-role DAL methods.**
- Move RLS-bypassing methods (e.g. `getAllUsersWithSubscriptions`) into a clearly named admin-only DAL or wrap them so they cannot be called without an admin guard; add a lint/review note.
- **Acceptance:** Service-role data methods are not reachable without an admin authorization check.

### Phase 3 — Secrets & Forgeable Tokens (High/Medium)

**SEC-1: Remove hardcoded fallback secrets.**
- Delete the `'fallback-secret-change-me'` fallback for `UNSUBSCRIBE_SECRET` (and the same pattern in `drip-scheduler.ts`). Fail closed at startup/use if the secret is unset. Rotate the production secret.
- **Acceptance:** With the env var unset, token generation/verification refuses to operate (no weak default); unsubscribe tokens cannot be forged.

**SEC-2: Cron secret + fallback admin UUID.**
- Ensure `CRON_SECRET` is required (reject if unset rather than comparing against `undefined`). Move `FALLBACK_ADMIN_IDS` out of source (env-driven, or remove if unused in the live `isAdmin` path).
- **Acceptance:** Missing `CRON_SECRET` causes cron endpoints to reject all requests; no admin identifier is hardcoded in source.

### Phase 4 — Hardening (Medium/Low)

**CFG-1: Security headers + build integrity.**
- Add a security-headers layer (middleware or `next.config`): `Content-Security-Policy` (start report-only, then enforce), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`. Plan removal of `ignoreBuildErrors` / `ignoreDuringBuilds` (fix the underlying type/lint errors).
- **Acceptance:** Security headers present on responses; CSP enforced without breaking the app; build no longer suppresses type/lint errors (tracked separately if large).

**CFG-2: Distributed rate limiting.**
- Route all expensive/unauthenticated endpoints (AI generation, promo, email-unlock, job-fetch) through the Upstash-backed limiter; reserve the in-memory limiter for non-security uses only.
- **Acceptance:** Rate limits hold across serverless instances/cold starts for the listed endpoints.

**AI-2 / AI-5: Sanitize rendered AI output.**
- Escape AI-generated fields before HTML interpolation in PDF generation (use the already-present `isomorphic-dompurify`, or jsPDF text APIs). Add an explicit `rehype-sanitize` chain to `MarkdownOutput.tsx` matching the blog renderer.
- **Acceptance:** Injected HTML in AI output does not execute in exported PDFs or rendered markdown.

**AI-3: DOCX/zip-bomb guard.**
- Add a wall-clock timeout and decompressed-size cap around `mammoth`/`pdf-parse` extraction (file size is already capped at 5MB pre-extraction).
- **Acceptance:** A malicious nested-archive DOCX is rejected/aborted rather than exhausting memory/CPU.

**AI-4: Email header injection.**
- Validate `replyTo` (and any user-influenced email field) with a strict email validator and reject CR/LF before passing to Resend.
- **Acceptance:** Newline/header-injection payloads in email fields are rejected.

**CFG-3: Dependency pinning.**
- Replace `"latest"` with pinned semver ranges for all ~25 affected dependencies; rely on the lockfile and a periodic update cadence.
- **Acceptance:** No dependency is pinned to `"latest"`.

**OPS-1: Schema/scripts consolidation.**
- Mirror all RLS definitions currently only in `scripts/` (applications, profiles, user_resumes, user_subscriptions, usage_tracking) into `schemas/` as the source of truth; document apply order.
- **Acceptance:** `schemas/` reflects the true RLS state; no table's protection lives only in an ad-hoc script.

### Phase 5 — Verification & Regression

- **RLS cross-user test suite:** for every user-data table, automated tests assert that User A cannot SELECT/UPDATE/DELETE User B's rows using an anon-key JWT, and that unauthenticated access returns nothing.
- **Promo abuse tests:** double-redemption across both endpoints, concurrent redemption (cap enforcement), permanent-grant rejection, and confirmation-on-paid-sub behavior.
- **SSRF tests:** internal/metadata targets blocked directly and via redirect.
- **Storage bucket check:** confirm resume storage bucket policies are private to the uploader (verify in Supabase; encode as SQL/policy if not already).
- **Acceptance:** The above tests run in CI and fail closed if any control regresses.

---

## Logical Dependency Chain

1. **Phase 0 (Data-Layer Lockdown)** first — it closes direct cross-user data exposure and is a prerequisite for trusting any application-layer fix. DB-1 (drop wildcard policies) must precede DB-2/DB-4 verification, since wildcard policies would mask test results.
2. **Phase 1 (Promo/Payment)** next — the `used_count`/uniqueness fixes (PROMO-2/3) depend on the corrected RLS/definer-function model from Phase 0 (the increment function should be the only writer of `used_count`).
3. **Phase 2 (Endpoint auth/SSRF)** is independent of the DB phases and can proceed in parallel once owners are freed up.
4. **Phase 3 (Secrets)** is small and independent; can ship anytime but before any public launch.
5. **Phase 4 (Hardening)** depends on nothing structurally; CSP rollout should be report-only first.
6. **Phase 5 (Verification)** ratifies all prior phases; the RLS test harness should be stood up early (during Phase 0) so each subsequent fix lands with a test.

---

## Risks and Mitigations

- **Dropping RLS policies breaks signup/trigger flows.** Mitigation: confirm trigger functions are `SECURITY DEFINER` (which already bypass RLS) before dropping the wildcard policies; test new-user provisioning in a staging DB via `run-schema.sh` against a copy.
- **Promo consolidation changes user-visible behavior.** Mitigation: preserve existing success messaging; back-fill `promo_code_usage` and dedup before adding the `UNIQUE` constraint to avoid migration failure.
- **CSP breaks third-party scripts (Stripe, PostHog, Vercel).** Mitigation: deploy `Content-Security-Policy-Report-Only` first, collect violations, then enforce.
- **Removing `ignoreBuildErrors` may surface a large backlog.** Mitigation: track as a separate cleanup effort; do not block the header/security work on a clean type pass.

---

## Appendix

- Source: defensive security audit (six parallel area reviews) and focused promo-code-system review, June 11, 2026.
- All schema changes ship as numbered migrations in `schemas/migrations/` and are applied with `./scripts/run-schema.sh`; field names verified against `schemas/` per project convention.
- Severity legend: **Critical** = direct cross-user data access or unauthorized paid-entitlement grant; **High** = exploitable with constraints (auth required, specific input) or significant data/abuse impact; **Medium** = meaningful weakness requiring chaining or misconfiguration; **Low** = hardening / defense-in-depth.
