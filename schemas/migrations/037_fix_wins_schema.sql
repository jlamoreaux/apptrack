-- 037_fix_wins_schema.sql
--
-- Fix: "Failed to log win" (POST /api/wins → 500) in production.
--
-- Root cause: a legacy `public.wins` table with an unrelated schema
-- (title / impact / tags[] / win_date / updated_at) already existed in prod, so
-- migration 032's `create table if not exists public.wins` was a silent no-op —
-- the CareerOtter columns were never created. Every wins code path (CRUD,
-- dashboard coverage, coach, case, zero-to-case, export, cron recap) expects the
-- 032 schema (text / impact_number / tag / source / created_at / edited_at), so
-- writes 500 and reads fail silently to an empty list.
--
-- The legacy table has 0 rows and no code references its columns, so we drop it
-- (CASCADE clears its legacy trigger + RLS policy) and recreate it exactly as
-- migration 032 defines. Safe: no data loss, no FK dependents.

drop table if exists public.wins cascade;

create table public.wins (
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

-- Service-role only (API routes use the service-role key, which bypasses RLS).
-- Intentionally no policies: client access denied by default, matching 032.
alter table public.wins enable row level security;
