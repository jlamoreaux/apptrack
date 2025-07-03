create table public.job_fit_analysis (
  id uuid not null default extensions.uuid_generate_v4 (),
  user_id uuid not null,
  job_description text not null,
  analysis_result text not null,
  fit_score integer not null check (fit_score >= 0 and fit_score <= 100),
  created_at timestamp with time zone null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone null default timezone ('utc'::text, now()),
  constraint job_fit_analysis_pkey primary key (id),
  constraint job_fit_analysis_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
) tablespace pg_default;

create index if not exists idx_job_fit_analysis_user_id on public.job_fit_analysis using btree (user_id) tablespace pg_default;

create index if not exists idx_job_fit_analysis_created_at on public.job_fit_analysis using btree (created_at) tablespace pg_default;

-- Enable RLS
alter table public.job_fit_analysis enable row level security;

-- RLS policies
create policy "Users can view their own job fit analyses" on public.job_fit_analysis
  for select using (auth.uid() = user_id);

create policy "Users can insert their own job fit analyses" on public.job_fit_analysis
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own job fit analyses" on public.job_fit_analysis
  for update using (auth.uid() = user_id);

create policy "Users can delete their own job fit analyses" on public.job_fit_analysis
  for delete using (auth.uid() = user_id);