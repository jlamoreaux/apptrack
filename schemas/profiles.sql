create table public.profiles (
  id uuid not null,
  email text not null,
  full_name text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint profiles_pkey primary key (id),
  constraint profiles_email_key unique (email),
  constraint profiles_id_fkey foreign KEY (id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;

create trigger handle_updated_at BEFORE
update on profiles for EACH row
execute FUNCTION handle_updated_at ();