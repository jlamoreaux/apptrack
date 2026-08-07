-- Per-application AI-tailored resume drafts. Generated from the user's primary
-- resume text plus the application's saved job description. One draft kept per
-- application (regenerating overwrites), so the table stays small and the
-- latest draft is always the one that matches the current JD.
create table if not exists public.tailored_resumes (
  id uuid primary key default gen_random_uuid (),
  user_id uuid not null references public.profiles (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  tailored_text text not null,
  created_at timestamptz not null default now(),
  constraint tailored_resumes_application_unique unique (user_id, application_id)
);

create index if not exists tailored_resumes_user_idx
  on public.tailored_resumes (user_id, created_at desc);

alter table public.tailored_resumes enable row level security;
-- No policies: service-role (API routes) only, like comp_entries.
