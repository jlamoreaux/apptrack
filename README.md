# CareerOtter

Your companion for every stage of your career. Land the job, log the wins, and make the case for what's next.

CareerOtter (formerly AppTrack) is a career companion web app at [careerotter.io](https://careerotter.io). It started as a job application tracker with AI coaching and now covers the full arc from job search to promotion: application tracking, win logging, comp tracking, and an AI coach grounded in the user's own evidence. `apptrack.ing` 301-redirects here; existing accounts and data carried over unchanged.

## Product

### Land it
- Unlimited application tracking, free on every tier
- Pipeline analytics with Sankey charts, interview notes, and contact management
- Roast My Resume: blunt, shareable resume feedback with no account required
- Free no-account AI tools (cover letter generator, job fit analysis, interview prep) with role-specific SEO landing pages
- Browser extension token flow for saving applications from job boards

### Track it
- Ten-second win logging, tagged across four impact areas (delivery, leadership, collaboration, craft)
- Comp history with equity, vesting schedules, and live stock-price scenarios
- Friday recap and weekly digest emails that write themselves from logged activity
- A Today dashboard that surfaces exactly one next move based on review countdown, log staleness, and case coverage

### Win it (Pro)
- AI coach grounded only in the user's logged wins, goal, and review date, with memory and guided flows
- Case coverage meter that names gaps before review season
- Promotion case and review-doc builder
- Comp coaching for the ask
- AI resume analysis, job fit analysis, cover letters, interview prep, and tailored resumes

### Pricing
Two tiers. Free covers every non-AI tool. Pro is $9/month or $90/year and unlocks every AI feature. A 7-day trial, a pre-signup trial budget, promo codes, and a free 30-day Pro offer for laid-off workers feed acquisition. Pricing and feature lists live in `lib/constants/plans.ts` and `lib/constants/homepage-content.ts`.

### Agent discovery
The site publishes machine-readable surfaces for AI agents: `/llms.txt`, `/openapi.json`, `/.well-known/api-catalog`, `/.well-known/ai-catalog.json`, agent skills under `/.well-known/agent-skills/`, and markdown content negotiation via `Accept: text/markdown`. See `docs/agent-discovery.md`.

## Tech stack

| Concern | Technology | Key locations |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript | `app/`, `next.config.mjs` |
| Hosting | Vercel, with Vercel Cron for scheduled jobs | `vercel.json`, `app/api/cron/**` |
| Database and auth | Supabase (Postgres with RLS, Auth, Storage) | `lib/supabase/*`, `schemas/*.sql` |
| AI | OpenAI via the Vercel AI SDK (`gpt-4o-mini` default, `gpt-4o` premium) | `lib/openai/*`, `lib/ai-coach/*`, `lib/careerotter/*` |
| Payments | Stripe | `lib/stripe/*`, `app/api/stripe/*` |
| Email | Resend | `lib/email/*` |
| Rate limiting and cache | Upstash Redis | `lib/redis/*` |
| Analytics | PostHog (product analytics, feature flags), Vercel Analytics | `lib/analytics/*` |
| Logging | Axiom via Winston | `lib/services/logger.service.ts` |
| Market data | Finnhub (stock prices for comp scenarios) | `lib/careerotter/stock-price.ts` |
| UI | Tailwind CSS, Radix UI, shadcn/ui, Lucide icons, Plotly (Sankey) | `components/`, `tailwind.config.ts` |
| Testing | Jest, React Testing Library, jest-axe | `__tests__/`, `jest.config.js` |

## Getting started

### Prerequisites
- Node.js 20+
- pnpm 9
- A Supabase project
- `psql` on your PATH (for running migrations)

### Environment variables

Create `.env.local` in the project root.

Required for the app to boot and for tests to import cleanly:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# OpenAI
OPENAI_API_KEY="sk-proj-..."

# Stripe
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."

# Browser extension JWTs
EXTENSION_JWT_SECRET="..."

# Canonical origin (defaults to https://careerotter.io)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Used by specific features (the feature degrades or is skipped when unset):

```bash
# Email
RESEND_API_KEY="re_..."
FROM_EMAIL="..."
RESEND_AUDIENCE_USERS="..."
RESEND_AUDIENCE_PAID_USERS="..."
RESEND_AUDIENCE_LEADS="..."
UNSUBSCRIBE_SECRET="..."

# Scheduled jobs (Vercel Cron authenticates with this)
CRON_SECRET="..."

# Analytics and logging
NEXT_PUBLIC_POSTHOG_KEY="phc_..."
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
AXIOM_TOKEN="..."
AXIOM_DATASET="..."

# Comp tracker stock prices
FINNHUB_API_KEY="..."

# Migrations (read by scripts/run-schema.sh from .env)
POSTGRES_URL_NON_POOLING="postgresql://..."
```

Grep for `process.env.` under `lib/` and `app/` for the complete list.

### Install and run

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database

Schemas and migrations live in `schemas/`. Apply a file with:

```bash
./scripts/run-schema.sh schemas/migrations/042_application_history_rls.sql
```

The script reads the database URL from `.env`, preferring `POSTGRES_URL_NON_POOLING` for DDL. Numbered migrations go in `schemas/migrations/`; feature schemas sit in `schemas/` root. See `schemas/README.md`.

## Project structure

```
app/
  (marketing)/       Public pages: homepage, free tools, roast, pricing, legal, auth
  (app)/dashboard/   Signed-in app: Today, applications, wins, comp, coach, review prep, settings
  api/               Route handlers (applications, ai-coach, careerotter, wins, stripe, cron, try, roast)
  blog/              MDX blog
  llms.txt, openapi.json, robots.txt, sitemap.ts, .well-known/   Agent discovery surfaces
components/          React components (ui/, dashboard/, ai-coach/, careerotter/, roast/, try/, landing/)
lib/
  constants/         Single sources of truth: plans, pricing copy, CareerOtter enums, routes
  careerotter/       Coach and case prompts, coverage, next move, recap, stock prices
  ai-coach/          Job fit, resume analysis, interview prep, cover letters
  supabase/          Server and admin clients, queries
  email/             Resend templates and senders
  agent-discovery/   Generators for llms.txt, OpenAPI, skills index, markdown negotiation
content/             Blog posts (MDX) and agent skill files
schemas/             SQL schemas and numbered migrations
types/               Shared TypeScript types (single source of truth in types/index.ts)
__tests__/           Jest suites (api, components, accessibility, security, integration, agent-discovery)
docs/                Design proposals, setup guides, and archived plans
```

## Scripts

```bash
pnpm dev            # Start the dev server
pnpm build          # Production build
pnpm start          # Serve the production build
pnpm lint           # ESLint
pnpm test           # Jest
pnpm test:watch     # Jest in watch mode
pnpm test:a11y      # Accessibility suites only
pnpm test:coverage  # Jest with coverage
pnpm db:schema      # Alias for scripts/run-schema.sh
```

## Scheduled jobs

Vercel Cron hits authenticated routes under `app/api/cron/` (see `vercel.json`): trial notifications, AI usage sync, drip emails, changelog generation, stale-application reminders, weekly digest, the Friday CareerOtter recap, and daily stock-price sync.

## Testing and CI

GitHub Actions runs `pnpm test` on every push and pull request to `main` (`.github/workflows/ci.yml`). Tests use stub environment values and never hit real services.

## Development conventions

`CLAUDE.md` is the working guide for this repo: UI style rules, architecture patterns (client components call API routes, never Supabase directly), schema field names, and constants conventions. Read it before making changes. `WARP.md` is a symlink to it for Warp users.

## Further reading

- `docs/agent-discovery.md` describes what the site publishes for AI agents and how to extend it
- `docs/stripe-2tier-setup.md` covers Stripe product and webhook setup
- `docs/posthog-ab-testing.md` covers feature flags and A/B tests
- `docs/design-proposals/` holds dated PRDs and RFCs
- `docs/archive/` holds completed implementation plans kept for reference
