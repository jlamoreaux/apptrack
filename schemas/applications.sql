create table public.applications (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  company text not null,
  role text not null,
  role_link text null,
  date_applied date not null,
  status text null default 'Applied'::text,
  notes text null default ''::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  archived boolean null default false,
  constraint applications_pkey primary key (id),
  constraint applications_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE,
  constraint applications_status_check check (
    (
      status = any (
        array[
          'Applied'::text,
          'Interview Scheduled'::text,
          'Interviewed'::text,
          'Offer'::text,
          'Hired'::text,
          'Rejected'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_applications_user_id on public.applications using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_applications_status on public.applications using btree (status) TABLESPACE pg_default;

create index IF not exists idx_applications_date_applied on public.applications using btree (date_applied) TABLESPACE pg_default;

create index IF not exists idx_applications_archived on public.applications using btree (user_id, archived) TABLESPACE pg_default;

create trigger handle_updated_at BEFORE
update on applications for EACH row
execute FUNCTION handle_updated_at ();

create trigger update_usage_on_delete
after DELETE on applications for EACH row
execute FUNCTION update_usage_count ();

create trigger update_usage_on_insert
after INSERT on applications for EACH row
execute FUNCTION update_usage_count ();