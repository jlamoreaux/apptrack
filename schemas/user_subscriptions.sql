create table public.user_subscriptions (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  plan_id uuid not null,
  status text null default 'active'::text,
  billing_cycle text null default 'monthly'::text,
  current_period_start timestamp with time zone null default now(),
  current_period_end timestamp with time zone null,
  stripe_subscription_id text null,
  stripe_customer_id text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  cancel_at_period_end boolean null default false,
  constraint user_subscriptions_pkey primary key (id),
  constraint user_subscriptions_plan_id_fkey foreign KEY (plan_id) references subscription_plans (id),
  constraint user_subscriptions_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE,
  constraint user_subscriptions_billing_cycle_check check (
    (
      billing_cycle = any (array['monthly'::text, 'yearly'::text])
    )
  ),
  constraint user_subscriptions_status_check check (
    (
      status = any (
        array[
          'active'::text,
          'canceled'::text,
          'past_due'::text,
          'trialing'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_user_subscriptions_user_id on public.user_subscriptions using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_user_subscriptions_status on public.user_subscriptions using btree (status) TABLESPACE pg_default;

create unique INDEX IF not exists idx_user_subscriptions_user_active on public.user_subscriptions using btree (user_id) TABLESPACE pg_default
where
  (status = 'active'::text);

create trigger handle_updated_at_subscriptions BEFORE
update on user_subscriptions for EACH row
execute FUNCTION handle_updated_at ();