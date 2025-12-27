create table public.user_resumes (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  file_url text not null,
  file_type text not null,
  extracted_text text null,
  uploaded_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint user_resumes_pkey primary key (id),
  constraint user_resumes_user_id_fkey foreign KEY (user_id) references profiles (id) on delete CASCADE
) TABLESPACE pg_default;

create unique INDEX IF not exists idx_user_resumes_user_id on public.user_resumes using btree (user_id) TABLESPACE pg_default;