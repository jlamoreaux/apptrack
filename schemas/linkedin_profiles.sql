create table public.linkedin_profiles (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  application_id uuid not null,
  profile_url text not null,
  name text null,
  title text null,
  profile_photo_url text null,
  headline text null,
  company text null,
  location text null,
  created_at timestamp with time zone null default now(),
  constraint linkedin_profiles_pkey primary key (id),
  constraint linkedin_profiles_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE,
  constraint linkedin_profiles_application_id_fkey foreign KEY (application_id) references applications (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_linkedin_profiles_application_id on public.linkedin_profiles using btree (application_id) TABLESPACE pg_default;
create index IF not exists idx_linkedin_profiles_user_id on public.linkedin_profiles using btree (user_id) TABLESPACE pg_default;