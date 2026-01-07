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
  is_active boolean not null default true,
  constraint subscription_plans_pkey primary key (id)
) TABLESPACE pg_default;

-- Column comments
comment on column subscription_plans.is_active is 'Whether the plan is available for new subscriptions. Inactive plans are hidden from pricing pages but existing subscribers retain access.';

create index IF not exists idx_subscription_plans_monthly_price on public.subscription_plans using btree (stripe_monthly_price_id) TABLESPACE pg_default;

create index IF not exists idx_subscription_plans_yearly_price on public.subscription_plans using btree (stripe_yearly_price_id) TABLESPACE pg_default;

create index IF not exists idx_subscription_plans_active on public.subscription_plans (is_active) where is_active = true;
