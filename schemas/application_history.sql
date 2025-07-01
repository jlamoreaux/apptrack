create table public.application_history (
  id uuid not null default gen_random_uuid (),
  application_id uuid not null,
  old_status text null,
  new_status text not null,
  changed_at timestamp with time zone null default now(),
  notes text null,
  constraint application_history_pkey primary key (id),
  constraint application_history_application_id_fkey foreign KEY (application_id) references applications (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_application_history_application_id on public.application_history using btree (application_id) TABLESPACE pg_default;

create index IF not exists idx_application_history_changed_at on public.application_history using btree (changed_at) TABLESPACE pg_default;