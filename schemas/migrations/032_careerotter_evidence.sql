-- CareerOtter Phase 2 (M2) — the evidence loop.
-- Three tables: the goal frame (career_profiles), the wins log (wins), and the
-- generated Friday summaries (weekly_recaps). All service-role only per
-- CLAUDE.md rule 4 (API-route access exclusively); RLS enabled with no policies
-- so anon/auth clients cannot read or write directly.
--
-- Constants that mirror these CHECK lists live in lib/constants/careerotter.ts.

-- ── career_profiles ────────────────────────────────────────────────────────
-- One row per user: the target the whole experience structures around. The
-- onboarding "fork" (RFC) is `mode`; job_search reuses the same data model.
create table if not exists public.career_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  mode text not null default 'promotion'
    check (mode in ('promotion', 'raise', 'job_search')),
  role text,
  level text,
  time_in_role text,
  target text,
  review_date date,
  zero_to_case_completed_at timestamptz,
  starter_case text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── wins ───────────────────────────────────────────────────────────────────
-- The evidence log. Logging is free and calls no model (habit before payment).
-- `tag` is one of the four impact areas the coverage meter balances.
create table if not exists public.wins (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  impact_number text,
  tag text check (tag in ('delivery', 'leadership', 'collaboration', 'craft')),
  source text not null default 'manual'
    check (source in ('manual', 'recap', 'zero_to_case', 'import')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists wins_user_created_idx
  on public.wins (user_id, created_at desc);

-- ── weekly_recaps ──────────────────────────────────────────────────────────
-- One generated recap per user per week (the Friday return hook). week_start is
-- the Monday of the recap's week; unique per user so the cron is idempotent.
create table if not exists public.weekly_recaps (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  generated_text text,
  wins_included int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists weekly_recaps_user_idx
  on public.weekly_recaps (user_id, week_start desc);

-- ── updated_at trigger on career_profiles ──────────────────────────────────
create trigger handle_updated_at before update on public.career_profiles
  for each row execute function handle_updated_at ();

-- ── RLS: service-role only ─────────────────────────────────────────────────
alter table public.career_profiles enable row level security;
alter table public.wins enable row level security;
alter table public.weekly_recaps enable row level security;
-- Intentionally no policies: only the service-role key (used by API routes)
-- bypasses RLS. Client access is denied by default.
