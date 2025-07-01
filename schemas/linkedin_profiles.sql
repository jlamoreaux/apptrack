create table public.linkedin_profiles (
  id uuid not null default gen_random_uuid (),
  application_id uuid not null,
  profile_url text not null,
  name text null,
  title text null,
  created_at timestamp with time zone null default now(),
  constraint linkedin_profiles_pkey primary key (id),
  constraint linkedin_profiles_application_id_fkey foreign KEY (application_id) references applications (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_linkedin_profiles_application_id on public.linkedin_profiles using btree (application_id) TABLESPACE pg_default;