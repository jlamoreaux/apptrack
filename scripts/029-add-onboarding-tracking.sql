-- Add onboarding tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding 
ON public.profiles(onboarding_completed) 
WHERE onboarding_completed = false;

-- Update existing users to have onboarding completed
-- (They've already been using the app)
UPDATE public.profiles 
SET onboarding_completed = true 
WHERE created_at < CURRENT_DATE;