# Cloudflare migration — account setup checklist

What to create in the new Cloudflare account, and which values to hand back. Nothing here
is wired up yet; this is preparation so the account setup happens in one pass.

**Status: this branch is not deployable to Cloudflare.** It still runs Next 15 on Vercel
against Supabase. See "What still has to be built" at the bottom.

---

## 1. Plan

**Workers Paid — $5/month.** Not optional. It is required for:

- **Cron Triggers** — you have 8 scheduled jobs
- **Queues** — needed for the per-user fan-out crons (`careerotter-recap` does 200 users ×
  1 LLM call sequentially and silently drops anyone past `MAX_USERS = 200`)
- **CPU limits** — Cron Triggers and Queue consumers get up to 15 min CPU; the free plan
  cannot run these jobs
- **Workers Logs retention** — 7 days on Paid vs 3 on Free, and 20M events/month included

At ~26 MB of data and 221 users, everything else sits inside the included allowances.
Expect roughly **$5–10/month all in**, versus ~$45 today (Supabase Pro + Vercel Pro).

## 2. Resources to create

| Resource | Purpose | Suggested name |
|---|---|---|
| **D1 database** | Replaces Supabase Postgres | `careerotter` |
| **R2 bucket** | Replaces Supabase Storage (`resumes`) | `careerotter-resumes` |
| **KV namespace** | Caching (roast cache, AI analysis cache) | `careerotter-cache` |
| **Queue** | Per-user cron fan-out, with a dead-letter queue | `user-jobs` + `user-jobs-dlq` |
| **AI Gateway** *(optional)* | Routes OpenAI calls for caching + observability | `careerotter` |

Durable Objects need no pre-creation — they are declared in `wrangler.jsonc`. They will
host rate limiting, which needs strong consistency and cannot use KV.

## 3. Values to hand back

```
CLOUDFLARE_ACCOUNT_ID     # Workers & Pages → Account details
CLOUDFLARE_API_TOKEN      # scoped token, see below
D1_DATABASE_ID            # from `wrangler d1 create` or the dashboard
KV_NAMESPACE_ID
R2_BUCKET_NAME
AI_GATEWAY_URL            # only if you create the gateway
```

**API token scope.** Use a custom token rather than the global key:

- Account → Workers Scripts → Edit
- Account → Workers KV Storage → Edit
- Account → Workers R2 Storage → Edit
- Account → D1 → Edit
- Account → Queues → Edit
- Zone → Workers Routes → Edit *(only once the domain is on Cloudflare)*

## 4. Things that need lead time — start these early

**Google OAuth redirect URI.** Add the Workers callback URL to the existing OAuth client
in Google Cloud Console. Google warns propagation can take from five minutes to several
hours. Adding a second URI is non-breaking, so add it a week before cutover, not during.
The only current entry point is `components/auth/google-signin-button.tsx`.

**Stripe webhook.** Register the Workers endpoint as a **second** endpoint alongside the
Vercel one, subscribed to the same six events. It will 503 until cutover and Stripe will
retry for 3 days, which is fine and expected.

**DNS.** `careerotter.io` needs to be on Cloudflare for a custom domain on the Worker.
That is a nameserver change at the registrar and should be done well ahead. Drop the TTL
on the app hostname to 60s about 48 hours before cutover.

## 5. Secrets to carry across

Set as Workers secrets (`wrangler secret put`), not plaintext vars:

```
OPENAI_API_KEY          STRIPE_SECRET_KEY        STRIPE_WEBHOOK_SECRET
RESEND_API_KEY          ENCRYPTION_KEY           EXTENSION_JWT_SECRET
CRON_SECRET             UNSUBSCRIBE_SECRET       IP_SALT
ANALYTICS_HASH_SECRET   LOG_SALT                 GITHUB_API_KEY
POSTHOG_API_KEY         RESEND_AUDIENCE_{LEADS,USERS,PAID_USERS}
BETTER_AUTH_SECRET      # new
```

> **Do not rotate `EXTENSION_JWT_SECRET`.** It is the one thing keeping live Chrome
> extension tokens working across the cutover — that layer authenticates off its own JWT
> rather than a Supabase session, so it survives untouched. Rotating it is a separate
> change with its own comms.

`ENCRYPTION_KEY` must also carry across unchanged: it decrypts data already at rest.

## 6. What is being dropped

No replacement needed for: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `POSTGRES_*`, `KV_REST_API_*` / `UPSTASH_REDIS_REST_*`
(→ Workers KV + Durable Objects), `AXIOM_TOKEN` / `AXIOM_DATASET` / `GRAFANA_LOKI_URL`
(→ Workers Logs), `VERCEL_URL`, `FINNHUB_API_KEY` (dormant — the stock-price cron is dark).

**Retained third parties:** Stripe (no Cloudflare equivalent for payments), Resend
(Cloudflare Email Routing is inbound-only — there is no native outbound transactional
email), OpenAI, PostHog, the LinkedIn pixel, and the GitHub API.

## 7. What still has to be built

In rough order. None of it is blocked on the Cloudflare account except the last two.

1. **Drizzle query migration** — 148 files, ~350 query sites. Highest risk, because
   dropping RLS removes the silent tenant-filter backstop from 149 files. Mitigated with a
   branded `UserScope` type and per-table isolation tests.
2. **Drain 39 functions and 23 triggers into app code.** After this the database holds no
   business logic, which is what makes D1 reachable.
3. **Port `lib/db/schema/` from `pg-core` to `sqlite-core`** and convert types: `jsonb` →
   TEXT, `uuid` → TEXT, GIN FTS → FTS5, and — needing a deliberate decision — `NUMERIC(12,2)`
   / `(14,4)` money in `comp_entries` → integer cents, since SQLite has no exact decimal.
4. **Better Auth**, preserving the 221 user UUIDs, 139 bcrypt hashes and 87 Google `sub`
   values so all 32 foreign keys survive.
5. **Workers compatibility**: `pdf-parse` → `unpdf` (diff the extracted text over the real
   corpus first — prompts are tuned on current output), `mammoth` browser build, Winston →
   Workers Logs, `safe-fetch`'s `dns/promises` → DNS-over-HTTPS, and `next/og` (a known
   sharp edge on Workers — spike it early).
6. **Crons → Cron Triggers + Queues.**
7. **Next 15 → 16, then vinext.** vinext targets Next 16 only and is explicitly not
   production-ready for every workload; `@opennextjs/cloudflare` is the fallback and
   nothing before this step is wasted either way.
