create table public.subscription_plans (
  id uuid not null default gen_random_uuid (),
  name text not null,
  price_monthly numeric(10, 2) null,
  price_yearly numeric(10, 2) null,
  max_applications integer null,
  features jsonb null default '[]'::jsonb,
  created_at timestamp with time zone null default now(),
  stripe_monthly_price_id text null,
  stripe_yearly_price_id text null,
  constraint subscription_plans_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists idx_subscription_plans_monthly_price on public.subscription_plans using btree (stripe_monthly_price_id) TABLESPACE pg_default;

create index IF not exists idx_subscription_plans_yearly_price on public.subscription_plans using btree (stripe_yearly_price_id) TABLESPACE pg_default;