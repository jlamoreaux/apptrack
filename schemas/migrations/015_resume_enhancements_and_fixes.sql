-- Migration 015: Resume Management Enhancements and Fixes
-- Adds missing indexes, triggers for auto-default assignment, and other improvements

-- ======================
-- 1. Add Missing Indexes for Performance
-- ======================

-- These indexes were mentioned in migration 013 but not actually created
-- They're critical for querying "which analyses used this resume"
CREATE INDEX IF NOT EXISTS idx_job_fit_analysis_user_resume_id
  ON public.job_fit_analysis(user_resume_id);

CREATE INDEX IF NOT EXISTS idx_cover_letters_user_resume_id
  ON public.cover_letters(user_resume_id);

CREATE INDEX IF NOT EXISTS idx_interview_prep_user_resume_id
  ON public.interview_prep(user_resume_id);

CREATE INDEX IF NOT EXISTS idx_resume_analysis_user_resume_id
  ON public.resume_analysis(user_resume_id);

-- Add composite index for common query pattern (user + resume)
CREATE INDEX IF NOT EXISTS idx_user_resumes_user_id_is_default
  ON public.user_resumes(user_id, is_default)
  WHERE is_default = true;

-- ======================
-- 2. Auto-Assign Default Resume on Delete
-- ======================

-- When a default resume is deleted, automatically promote another resume to default
-- This ensures users always have a default resume if they have any resumes
CREATE OR REPLACE FUNCTION auto_assign_default_resume()
RETURNS TRIGGER AS $$
DECLARE
  next_resume_id UUID;
BEGIN
  -- If a default resume was deleted and user still has other resumes
  IF OLD.is_default = true THEN
    -- Find the resume with the lowest display_order
    SELECT id INTO next_resume_id
    FROM public.user_resumes
    WHERE user_id = OLD.user_id
      AND id != OLD.id
    ORDER BY display_order ASC
    LIMIT 1;

    -- Set it as default if found
    IF next_resume_id IS NOT NULL THEN
      UPDATE public.user_resumes
      SET is_default = true,
          updated_at = NOW()
      WHERE id = next_resume_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_auto_assign_default_resume ON public.user_resumes;

CREATE TRIGGER trigger_auto_assign_default_resume
  BEFORE DELETE ON public.user_resumes
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_default_resume();

-- ======================
-- 3. Update Resume Limit Trigger with Better Error Message
-- ======================

-- Improve the error message to help with frontend error handling
CREATE OR REPLACE FUNCTION check_resume_limit()
RETURNS TRIGGER AS $$
DECLARE
  resume_count INTEGER;
  user_plan TEXT;
  max_resumes INTEGER;
BEGIN
  SELECT COUNT(*) INTO resume_count
  FROM public.user_resumes
  WHERE user_id = NEW.user_id;

  -- Get user's plan (AI Coach/Pro = 100, Free = 1)
  SELECT COALESCE(sp.name, 'Free') INTO user_plan
  FROM public.profiles p
  LEFT JOIN public.user_subscriptions us ON p.id = us.user_id
  LEFT JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE p.id = NEW.user_id
    AND (us.status IN ('active', 'trialing') OR us.status IS NULL);

  max_resumes := CASE WHEN user_plan IN ('AI Coach', 'Pro') THEN 100 ELSE 1 END;

  IF TG_OP = 'INSERT' AND resume_count >= max_resumes THEN
    RAISE EXCEPTION 'Resume limit reached. Your % plan allows % resume(s).', user_plan, max_resumes
      USING ERRCODE = '23514'; -- check_violation
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Trigger already exists from migration 012, just updating the function

-- ======================
-- 4. Add Constraint: Prevent display_order Duplicates
-- ======================

-- While not strictly required, this helps maintain data integrity
-- Uses a unique index that allows the same display_order for different users
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_resumes_user_display_order
  ON public.user_resumes(user_id, display_order);

-- ======================
-- 5. Add Validation: Ensure name is not empty
-- ======================

-- Add check constraint to ensure name is always non-empty after trimming
ALTER TABLE public.user_resumes
  DROP CONSTRAINT IF EXISTS check_name_not_empty;

ALTER TABLE public.user_resumes
  ADD CONSTRAINT check_name_not_empty
  CHECK (TRIM(name) != '');

-- ======================
-- 6. Add Validation: Ensure display_order is positive
-- ======================

ALTER TABLE public.user_resumes
  DROP CONSTRAINT IF EXISTS check_display_order_positive;

ALTER TABLE public.user_resumes
  ADD CONSTRAINT check_display_order_positive
  CHECK (display_order > 0);

-- ======================
-- 7. Update updated_at timestamp on changes
-- ======================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_resumes_updated_at ON public.user_resumes;

CREATE TRIGGER trigger_user_resumes_updated_at
  BEFORE UPDATE ON public.user_resumes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ======================
-- 8. Add Comments for Documentation
-- ======================

COMMENT ON TABLE public.user_resumes IS
  'Stores user resumes with multi-resume support. Free users: 1 resume, AI Coach/Pro: 100 resumes.';

COMMENT ON COLUMN public.user_resumes.is_default IS
  'Indicates the default resume used for AI features. Enforced to be unique per user by trigger.';

COMMENT ON COLUMN public.user_resumes.display_order IS
  'Order in which resumes are displayed in the UI. Must be positive and unique per user.';

COMMENT ON COLUMN public.user_resumes.extracted_text IS
  'Plain text extracted from the resume file for AI processing.';

COMMENT ON FUNCTION check_resume_limit() IS
  'Enforces resume limits based on subscription plan: Free=1, AI Coach/Pro=100';

COMMENT ON FUNCTION auto_assign_default_resume() IS
  'Automatically promotes another resume to default when the current default is deleted';

-- ======================
-- 9. Grant Necessary Permissions
-- ======================

-- Ensure authenticated users can perform all resume operations
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_resumes TO authenticated;
GRANT SELECT ON public.user_subscriptions TO authenticated;
GRANT SELECT ON public.subscription_plans TO authenticated;

-- ======================
-- 10. Verification Queries
-- ======================

-- To verify the migration worked, you can run these queries:
--
-- Check indexes:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'user_resumes';
--
-- Check triggers:
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE event_object_table = 'user_resumes';
--
-- Check constraints:
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'user_resumes';
