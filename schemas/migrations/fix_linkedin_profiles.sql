-- Fix LinkedIn Profiles Schema
-- This migration adds missing columns to the existing linkedin_profiles table

-- Check if user_id column exists, if not add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'linkedin_profiles' 
        AND column_name = 'user_id'
    ) THEN
        -- First, we need to add user_id column
        ALTER TABLE public.linkedin_profiles 
        ADD COLUMN user_id uuid;
        
        -- Populate user_id from applications table
        UPDATE public.linkedin_profiles lp
        SET user_id = a.user_id
        FROM public.applications a
        WHERE lp.application_id = a.id
        AND lp.user_id IS NULL;
        
        -- Add foreign key constraint
        ALTER TABLE public.linkedin_profiles
        ADD CONSTRAINT linkedin_profiles_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        
        -- Create index for user_id
        CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_user_id 
        ON public.linkedin_profiles USING btree (user_id);
    END IF;
END $$;

-- Add enhanced profile fields if they don't exist
DO $$
BEGIN
    -- Add profile_photo_url if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'linkedin_profiles' 
        AND column_name = 'profile_photo_url'
    ) THEN
        ALTER TABLE public.linkedin_profiles 
        ADD COLUMN profile_photo_url text;
    END IF;
    
    -- Add headline if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'linkedin_profiles' 
        AND column_name = 'headline'
    ) THEN
        ALTER TABLE public.linkedin_profiles 
        ADD COLUMN headline text;
    END IF;
    
    -- Add company if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'linkedin_profiles' 
        AND column_name = 'company'
    ) THEN
        ALTER TABLE public.linkedin_profiles 
        ADD COLUMN company text;
    END IF;
    
    -- Add location if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'linkedin_profiles' 
        AND column_name = 'location'
    ) THEN
        ALTER TABLE public.linkedin_profiles 
        ADD COLUMN location text;
    END IF;
    
    -- Add username if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'linkedin_profiles' 
        AND column_name = 'username'
    ) THEN
        ALTER TABLE public.linkedin_profiles 
        ADD COLUMN username text;
        
        -- Extract username from existing URLs
        UPDATE public.linkedin_profiles
        SET username = regexp_replace(profile_url, '.*linkedin\.com/in/([^/?]+).*', '\1')
        WHERE username IS NULL AND profile_url IS NOT NULL;
    END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE public.linkedin_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DO $$
BEGIN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view their own LinkedIn profiles" ON public.linkedin_profiles;
    DROP POLICY IF EXISTS "Users can insert their own LinkedIn profiles" ON public.linkedin_profiles;
    DROP POLICY IF EXISTS "Users can update their own LinkedIn profiles" ON public.linkedin_profiles;
    DROP POLICY IF EXISTS "Users can delete their own LinkedIn profiles" ON public.linkedin_profiles;
END $$;

-- Create RLS policies
CREATE POLICY "Users can view their own LinkedIn profiles" ON public.linkedin_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own LinkedIn profiles" ON public.linkedin_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own LinkedIn profiles" ON public.linkedin_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own LinkedIn profiles" ON public.linkedin_profiles
  FOR DELETE
  USING (auth.uid() = user_id);