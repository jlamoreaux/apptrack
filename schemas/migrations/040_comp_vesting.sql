-- Optional vesting schedule on comp entries, so the comp page can project
-- multi-year total comp instead of only showing a point-in-time number.
-- vest_start defaults to the entry's effective_date in app logic when absent;
-- vest_years is the grant's total vesting duration. Both nullable — entries
-- without them keep the existing flat-equity behavior.
alter table public.comp_entries add column if not exists vest_start date;
alter table public.comp_entries add column if not exists vest_years numeric(4,2);
