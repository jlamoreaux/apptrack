-- 035_comp_equity_shares.sql
-- Model equity as ticker + shares (CareerOtter comp tracker, equity slider Phase 1).
-- Adds a stock ticker and a share count so the app can compute equity value from a
-- user-supplied price (what-if scenarios). No live/external price data in this phase.

alter table public.comp_entries add column if not exists ticker text;
alter table public.comp_entries add column if not exists shares numeric(14,4);
