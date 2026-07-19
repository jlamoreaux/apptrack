-- CareerOtter Phase 2 — enforce the Monday week boundary on weekly_recaps.
-- Separate migration (not an edit to 032): 032 uses CREATE TABLE IF NOT EXISTS,
-- so amending it in place would silently skip the constraint on any database
-- where 032 already ran. ALTER guarantees the CHECK is added everywhere 034 runs.
-- Postgres extract(dow) is 0=Sunday..6=Saturday, so Monday = 1. The recap cron
-- (weekStartOf) already computes Monday 00:00 UTC, so existing rows conform.

alter table public.weekly_recaps
  add constraint weekly_recaps_week_start_monday
  check (extract(dow from week_start) = 1);
