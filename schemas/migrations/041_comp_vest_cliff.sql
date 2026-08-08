-- Optional vesting cliff on comp entries. With a cliff, nothing vests until
-- cliff_months after vest_start; the accrued amount then vests at once and
-- the remainder continues linearly. Null means no cliff (pure linear vest).
alter table public.comp_entries add column if not exists vest_cliff_months integer;
