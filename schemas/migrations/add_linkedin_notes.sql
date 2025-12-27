-- Add notes field to linkedin_profiles table
ALTER TABLE public.linkedin_profiles 
ADD COLUMN IF NOT EXISTS notes text;

-- Add comment for documentation
COMMENT ON COLUMN public.linkedin_profiles.notes IS 'User notes about this LinkedIn contact';