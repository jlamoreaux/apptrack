-- Migration 012: Multi-Resume Support
-- Enable users to store multiple resumes with names, descriptions, and default selection
-- Free users: 1 resume limit, Paid users (AI Coach/Pro): 100 resumes

-- Step 1: Drop unique constraint on user_id (allows multiple resumes per user)
DROP INDEX IF EXISTS idx_user_resumes_user_id;

-- Step 2: Add new columns for multi-resume functionality
ALTER TABLE public.user_resumes
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Step 3: Backfill existing data
-- Extract filename from URL for name, mark all existing resumes as default
UPDATE public.user_resumes
SET
  name = COALESCE(
    -- Extract filename from URL (everything after last /)
    substring(file_url from '([^/]+)$'),
    'My Resume'
  ),
  description = 'Uploaded resume',
  is_default = true,
  display_order = 1
WHERE name IS NULL;

-- Step 4: Make name required after backfill
ALTER TABLE public.user_resumes
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN name SET DEFAULT 'My Resume';

-- Step 5: Add indexes for performance
-- Fast lookup of default resume per user
CREATE INDEX IF NOT EXISTS idx_user_resumes_user_id_default
  ON public.user_resumes(user_id, is_default);

-- Fast sorted retrieval of user's resumes
CREATE INDEX IF NOT EXISTS idx_user_resumes_user_id_order
  ON public.user_resumes(user_id, display_order);

-- Step 6: Enforce constraint - only one default resume per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_resumes_one_default_per_user
  ON public.user_resumes(user_id)
  WHERE is_default = true;

-- Step 7: Create trigger function to auto-unset other defaults
CREATE OR REPLACE FUNCTION public.enforce_one_default_resume()
RETURNS TRIGGER AS $$
BEGIN
  -- When setting a resume as default, unset all other defaults for this user
  IF NEW.is_default = true THEN
    UPDATE public.user_resumes
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce one default per user
DROP TRIGGER IF EXISTS trigger_enforce_one_default_resume ON public.user_resumes;
CREATE TRIGGER trigger_enforce_one_default_resume
  BEFORE INSERT OR UPDATE ON public.user_resumes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_one_default_resume();

-- Step 8: Create trigger function to enforce resume limits by plan
CREATE OR REPLACE FUNCTION public.check_resume_limit()
RETURNS TRIGGER AS $$
DECLARE
  resume_count INTEGER;
  user_plan TEXT;
  max_resumes INTEGER;
BEGIN
  -- Count user's current resumes
  SELECT COUNT(*) INTO resume_count
  FROM public.user_resumes
  WHERE user_id = NEW.user_id;

  -- Get user's active plan
  -- Check for active or trialing subscriptions, default to 'Free' if none
  SELECT COALESCE(sp.name, 'Free') INTO user_plan
  FROM public.profiles p
  LEFT JOIN public.user_subscriptions us ON p.id = us.user_id
  LEFT JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE p.id = NEW.user_id
    AND (us.status IN ('active', 'trialing') OR us.status IS NULL)
  LIMIT 1;

  -- Set max resumes based on plan
  -- AI Coach and Pro plans: 100 resumes
  -- Free plan: 1 resume
  max_resumes := CASE
    WHEN user_plan IN ('AI Coach', 'Pro') THEN 100
    ELSE 1
  END;

  -- Check limit only on INSERT (not UPDATE)
  IF TG_OP = 'INSERT' AND resume_count >= max_resumes THEN
    RAISE EXCEPTION 'Resume limit reached. Your % plan allows % resume(s). Upgrade to add more resumes.', user_plan, max_resumes;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check resume limits before insert
DROP TRIGGER IF EXISTS trigger_check_resume_limit ON public.user_resumes;
CREATE TRIGGER trigger_check_resume_limit
  BEFORE INSERT ON public.user_resumes
  FOR EACH ROW
  EXECUTE FUNCTION public.check_resume_limit();

-- Step 9: Add helpful comments
COMMENT ON COLUMN public.user_resumes.name IS 'User-provided name for the resume (e.g., "Software Engineer Resume", "Marketing Manager CV")';
COMMENT ON COLUMN public.user_resumes.description IS 'Optional description to help user remember what this resume is for';
COMMENT ON COLUMN public.user_resumes.is_default IS 'Whether this is the default resume to use in AI features. Only one per user.';
COMMENT ON COLUMN public.user_resumes.display_order IS 'Order for displaying resumes in UI (lower numbers first)';
