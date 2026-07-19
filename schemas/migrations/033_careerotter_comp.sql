-- CareerOtter Phase 2 (M5) — comp tracker.
-- The user's own compensation history: base + bonus + equity, dated. Stored and
-- charted; the market-vs-you delta feeds the coach. Market reference data is NOT
-- stored here (it's a curated static dataset in lib/careerotter/market-data.ts,
-- sourced from BLS OES + public aggregates). Service-role only, like the rest
-- of the M2/M3 tables.

create table if not exists public.comp_entries (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  effective_date date not null,
  base numeric(12, 2) not null,
  bonus numeric(12, 2) not null default 0,
  equity numeric(12, 2) not null default 0,
  currency text not null default 'USD',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists comp_entries_user_date_idx
  on public.comp_entries (user_id, effective_date desc);

alter table public.comp_entries enable row level security;
-- No policies: service-role (API routes) only.
