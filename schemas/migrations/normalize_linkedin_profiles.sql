-- Migration: Normalize LinkedIn Profiles Schema
-- This migration transforms the existing schema to a normalized structure
-- where LinkedIn profiles are shared across users

-- Step 1: Create the new normalized tables
-- Create the shared linkedin_profiles table
create table if not exists public.linkedin_profiles_new (
  id uuid not null default gen_random_uuid(),
  profile_url text not null unique,
  username text null,
  name text null,
  headline text null,
  title text null,
  company text null,
  location text null,
  profile_photo_url text null,
  last_scraped_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint linkedin_profiles_new_pkey primary key (id)
) tablespace pg_default;

create unique index if not exists idx_linkedin_profiles_new_url 
  on public.linkedin_profiles_new using btree (profile_url) tablespace pg_default;

-- Create the junction table
create table if not exists public.application_linkedin_contacts (
  id uuid not null default gen_random_uuid(),
  application_id uuid not null,
  linkedin_profile_id uuid not null,
  user_id uuid not null,
  relationship_type text null,
  notes text null,
  contacted boolean not null default false,
  contacted_at timestamp with time zone null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint application_linkedin_contacts_pkey primary key (id),
  constraint application_linkedin_contacts_app_fkey 
    foreign key (application_id) references applications (id) on delete cascade,
  constraint application_linkedin_contacts_profile_fkey 
    foreign key (linkedin_profile_id) references linkedin_profiles_new (id) on delete restrict,
  constraint application_linkedin_contacts_user_fkey 
    foreign key (user_id) references auth.users (id) on delete cascade,
  constraint unique_application_profile unique (application_id, linkedin_profile_id)
) tablespace pg_default;

-- Create indexes
create index if not exists idx_app_linkedin_contacts_app_id 
  on public.application_linkedin_contacts using btree (application_id);
create index if not exists idx_app_linkedin_contacts_profile_id 
  on public.application_linkedin_contacts using btree (linkedin_profile_id);
create index if not exists idx_app_linkedin_contacts_user_id 
  on public.application_linkedin_contacts using btree (user_id);

-- Step 2: Migrate existing data (if the old table exists)
do $$
begin
  if exists (select 1 from information_schema.tables 
             where table_schema = 'public' 
             and table_name = 'linkedin_profiles') then
    
    -- Insert unique profiles into the new table
    insert into public.linkedin_profiles_new (
      profile_url, name, title, headline, company, location, profile_photo_url, created_at
    )
    select distinct on (profile_url)
      profile_url, name, title, headline, company, location, profile_photo_url, created_at
    from public.linkedin_profiles
    where profile_url is not null
    on conflict (profile_url) do nothing;
    
    -- Create junction table entries
    insert into public.application_linkedin_contacts (
      application_id, linkedin_profile_id, user_id, created_at
    )
    select 
      old.application_id,
      new.id,
      old.user_id,
      old.created_at
    from public.linkedin_profiles old
    join public.linkedin_profiles_new new on old.profile_url = new.profile_url
    where old.application_id is not null
      and old.user_id is not null
    on conflict (application_id, linkedin_profile_id) do nothing;
    
    -- Rename old table for backup
    alter table public.linkedin_profiles rename to linkedin_profiles_backup;
    
    -- Remove old indexes that might conflict
    drop index if exists idx_linkedin_profiles_application_id;
    drop index if exists idx_linkedin_profiles_user_id;
  end if;
end $$;

-- Step 3: Rename new table to final name
alter table public.linkedin_profiles_new rename to linkedin_profiles;
alter index idx_linkedin_profiles_new_url rename to idx_linkedin_profiles_url;

-- Step 4: Create the upsert function
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

-- Step 5: Create view for easier querying
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

-- Step 6: Enable RLS
alter table public.application_linkedin_contacts enable row level security;

-- RLS Policies
create policy "Users can view their own LinkedIn contacts" 
  on public.application_linkedin_contacts
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own LinkedIn contacts" 
  on public.application_linkedin_contacts
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own LinkedIn contacts" 
  on public.application_linkedin_contacts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own LinkedIn contacts" 
  on public.application_linkedin_contacts
  for delete
  using (auth.uid() = user_id);