create table public.interview_prep (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  user_resume_id uuid null,
  resume_text text null,
  job_description text null,
  job_url text null,
  interview_context text null,
  prep_content jsonb null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint interview_prep_pkey primary key (id),
  constraint interview_prep_user_id_fkey foreign KEY (user_id) references auth.users (id),
  constraint interview_prep_user_resume_id_fkey foreign KEY (user_resume_id) references user_resumes (id)
) TABLESPACE pg_default;

create index IF not exists idx_interview_prep_user_resume_id on public.interview_prep using btree (user_resume_id) TABLESPACE pg_default;

create index IF not exists idx_interview_prep_job_url on public.interview_prep using btree (job_url) TABLESPACE pg_default;