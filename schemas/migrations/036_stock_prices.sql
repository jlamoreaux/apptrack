-- 036_stock_prices.sql
-- Cached live stock prices for the CareerOtter comp equity feature (Phase 2).
-- A daily cron polls Finnhub for the tickers referenced by comp_entries and
-- upserts the latest price here, so the equity scenario slider can anchor on the
-- real market price instead of the implied per-share price. Public tickers only.
-- Service-role only (written/read by API routes); no RLS policies are defined.

create table if not exists public.stock_prices (
  ticker text primary key,
  price numeric(14,4) not null,
  currency text not null default 'USD',
  as_of timestamptz not null default now()
);

alter table public.stock_prices enable row level security;
-- service-role only (API routes), no policies.
