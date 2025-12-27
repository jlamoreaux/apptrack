create table public.resume_analysis (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  user_resume_id uuid null,
  resume_text text null,
  job_description text null,
  job_url text null,
  analysis_result jsonb null,
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint resume_analysis_pkey primary key (id),
  constraint resume_analysis_user_id_fkey foreign KEY (user_id) references auth.users (id),
  constraint resume_analysis_user_resume_id_fkey foreign KEY (user_resume_id) references user_resumes (id)
) TABLESPACE pg_default;