-- Migration: Add user_id and enhance linkedin_profiles table
-- This migration adds user_id column and additional fields for profile information

-- Add user_id column to linkedin_profiles table
ALTER TABLE public.linkedin_profiles 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add enhanced profile fields
ALTER TABLE public.linkedin_profiles 
ADD COLUMN IF NOT EXISTS profile_photo_url text,
ADD COLUMN IF NOT EXISTS headline text,
ADD COLUMN IF NOT EXISTS company text,
ADD COLUMN IF NOT EXISTS location text;

-- Create index for user_id for better query performance
CREATE INDEX IF NOT EXISTS idx_linkedin_profiles_user_id 
ON public.linkedin_profiles USING btree (user_id);

-- Update existing records to set user_id from their related applications
-- This assumes applications table has user_id
UPDATE public.linkedin_profiles lp
SET user_id = a.user_id
FROM public.applications a
WHERE lp.application_id = a.id
AND lp.user_id IS NULL;

-- Make user_id NOT NULL after populating existing records
-- Note: This might fail if there are orphaned linkedin_profiles without valid applications
-- In that case, you may need to delete orphaned records first
ALTER TABLE public.linkedin_profiles 
ALTER COLUMN user_id SET NOT NULL;

-- Add RLS policies for linkedin_profiles
ALTER TABLE public.linkedin_profiles ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own LinkedIn profiles
CREATE POLICY "Users can view their own LinkedIn profiles" ON public.linkedin_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy for users to insert their own LinkedIn profiles
CREATE POLICY "Users can insert their own LinkedIn profiles" ON public.linkedin_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own LinkedIn profiles
CREATE POLICY "Users can update their own LinkedIn profiles" ON public.linkedin_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to delete their own LinkedIn profiles
CREATE POLICY "Users can delete their own LinkedIn profiles" ON public.linkedin_profiles
  FOR DELETE
  USING (auth.uid() = user_id);