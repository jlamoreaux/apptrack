-- Normalized LinkedIn Profile Schema
-- This design allows multiple applications to reference the same LinkedIn profile
-- while maintaining user-specific relationships and notes

-- Table 1: LinkedIn Profiles (shared across all users)
-- Each unique LinkedIn profile has one entry here
create table public.linkedin_profiles (
  id uuid not null default gen_random_uuid(),
  profile_url text not null unique, -- Unique constraint ensures one entry per LinkedIn URL
  username text null, -- Extracted from URL (e.g., "john-doe" from linkedin.com/in/john-doe)
  name text null,
  headline text null,
  title text null,
  company text null,
  location text null,
  profile_photo_url text null,
  last_scraped_at timestamp with time zone null, -- Track when we last fetched data
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint linkedin_profiles_pkey primary key (id)
) tablespace pg_default;

-- Index for fast URL lookups (used for upsert operations)
create unique index idx_linkedin_profiles_url on public.linkedin_profiles using btree (profile_url) tablespace pg_default;
create index idx_linkedin_profiles_username on public.linkedin_profiles using btree (username) tablespace pg_default;

-- Table 2: Application LinkedIn Contacts (junction table)
-- Links applications to LinkedIn profiles with user-specific data
create table public.application_linkedin_contacts (
  id uuid not null default gen_random_uuid(),
  application_id uuid not null,
  linkedin_profile_id uuid not null,
  user_id uuid not null, -- Denormalized for RLS policies
  relationship_type text null, -- e.g., "Hiring Manager", "Recruiter", "Team Member", "Referral"
  notes text null, -- User's private notes about this contact
  contacted boolean not null default false,
  contacted_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint application_linkedin_contacts_pkey primary key (id),
  constraint application_linkedin_contacts_app_fkey foreign key (application_id) references applications (id) on delete cascade,
  constraint application_linkedin_contacts_profile_fkey foreign key (linkedin_profile_id) references linkedin_profiles (id) on delete restrict,
  constraint application_linkedin_contacts_user_fkey foreign key (user_id) references auth.users (id) on delete cascade,
  -- Prevent duplicate links between same application and profile
  constraint unique_application_profile unique (application_id, linkedin_profile_id)
) tablespace pg_default;

-- Indexes for performance
create index idx_app_linkedin_contacts_app_id on public.application_linkedin_contacts using btree (application_id) tablespace pg_default;
create index idx_app_linkedin_contacts_profile_id on public.application_linkedin_contacts using btree (linkedin_profile_id) tablespace pg_default;
create index idx_app_linkedin_contacts_user_id on public.application_linkedin_contacts using btree (user_id) tablespace pg_default;

-- Enable RLS on the junction table (profiles table doesn't need RLS as it's shared)
alter table public.application_linkedin_contacts enable row level security;

-- RLS Policies for application_linkedin_contacts
-- Users can only see/modify their own contact relationships
create policy "Users can view their own LinkedIn contacts" on public.application_linkedin_contacts
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own LinkedIn contacts" on public.application_linkedin_contacts
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own LinkedIn contacts" on public.application_linkedin_contacts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own LinkedIn contacts" on public.application_linkedin_contacts
  for delete
  using (auth.uid() = user_id);

-- Function to upsert LinkedIn profile (insert or update based on URL)
create or replace function upsert_linkedin_profile(
  p_profile_url text,
  p_name text default null,
  p_headline text default null,
  p_title text default null,
  p_company text default null,
  p_location text default null,
  p_profile_photo_url text default null
) returns uuid
language plpgsql
as $$
declare
  v_profile_id uuid;
  v_username text;
begin
  -- Extract username from URL
  v_username := regexp_replace(p_profile_url, '.*linkedin\.com/in/([^/]+).*', '\1');
  
  -- Try to insert or update the profile
  insert into public.linkedin_profiles (
    profile_url, username, name, headline, title, company, location, profile_photo_url
  ) values (
    p_profile_url, v_username, p_name, p_headline, p_title, p_company, p_location, p_profile_photo_url
  )
  on conflict (profile_url) do update set
    name = coalesce(excluded.name, linkedin_profiles.name),
    headline = coalesce(excluded.headline, linkedin_profiles.headline),
    title = coalesce(excluded.title, linkedin_profiles.title),
    company = coalesce(excluded.company, linkedin_profiles.company),
    location = coalesce(excluded.location, linkedin_profiles.location),
    profile_photo_url = coalesce(excluded.profile_photo_url, linkedin_profiles.profile_photo_url),
    updated_at = now()
  returning id into v_profile_id;
  
  return v_profile_id;
end;
$$;

-- View to simplify querying contacts with profile data
create or replace view application_contacts_with_profiles as
select 
  alc.*,
  lp.profile_url,
  lp.username,
  lp.name,
  lp.headline,
  lp.title,
  lp.company,
  lp.location,
  lp.profile_photo_url,
  a.company as application_company,
  a.role as application_role
from application_linkedin_contacts alc
join linkedin_profiles lp on alc.linkedin_profile_id = lp.id
join applications a on alc.application_id = a.id;