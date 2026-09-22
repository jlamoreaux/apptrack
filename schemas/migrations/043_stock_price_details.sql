-- 043_stock_price_details.sql
-- Richer stock quote cache for the comp page's company card. The daily cron
-- already stores the current price; it now also keeps the day's move and the
-- company profile (name, exchange, market cap, logo) so the page can show a
-- ticker the way a finance site does, instead of a bare number.
-- Profile fields refresh on their own cadence (profile_as_of); the quote
-- fields refresh every run. All nullable: rows written before this migration
-- keep working with the fields simply absent.

alter table public.stock_prices add column if not exists change numeric(14,4);
alter table public.stock_prices add column if not exists change_pct numeric(10,4);
alter table public.stock_prices add column if not exists previous_close numeric(14,4);
alter table public.stock_prices add column if not exists company_name text;
alter table public.stock_prices add column if not exists exchange text;
-- Market capitalization in millions of USD, as Finnhub reports it.
alter table public.stock_prices add column if not exists market_cap_musd numeric(18,2);
alter table public.stock_prices add column if not exists logo_url text;
alter table public.stock_prices add column if not exists profile_as_of timestamptz;
