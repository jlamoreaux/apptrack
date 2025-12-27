create table public.usage_tracking (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  applications_count integer null default 0,
  last_updated timestamp with time zone null default now(),
  constraint usage_tracking_pkey primary key (id),
  constraint unique_user_usage unique (user_id),
  constraint usage_tracking_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_usage_tracking_user_id on public.usage_tracking using btree (user_id) TABLESPACE pg_default;