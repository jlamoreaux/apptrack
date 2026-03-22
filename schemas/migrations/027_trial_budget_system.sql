-- Migration 027: Trial Budget System
-- Replaces daily per-feature usage tracking with a fixed one-time budget of 5 analyses
-- shared across all AI tools (Job Fit, Interview Prep, Cover Letter).

-- ============================================================================
-- Step 1: Add trial budget columns to profiles
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_analyses_used INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_trial_onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.ai_analyses_used IS
  'Number of free-tier AI analyses consumed (budget of 5 total, shared across all tools)';

COMMENT ON COLUMN public.profiles.ai_trial_onboarding_completed IS
  'Whether user has completed the AI tool discovery onboarding interstitial';

-- ============================================================================
-- Step 2: Add constraint to prevent negative or over-budget values
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ai_analyses_used_non_negative'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT ai_analyses_used_non_negative CHECK (ai_analyses_used >= 0);
  END IF;
END $$;

-- ============================================================================
-- Step 3: Atomic check-and-decrement function
-- Returns the new usage count if successful, -1 if budget exhausted
-- ============================================================================

CREATE OR REPLACE FUNCTION consume_ai_analysis(p_user_id UUID, p_limit INTEGER DEFAULT 5)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.profiles
  SET ai_analyses_used = ai_analyses_used + 1,
      updated_at = NOW()
  WHERE id = p_user_id
    AND ai_analyses_used < p_limit
  RETURNING ai_analyses_used INTO new_count;

  IF new_count IS NULL THEN
    RETURN -1; -- Budget exhausted
  END IF;

  RETURN new_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 4: Refund function for failed analyses
-- ============================================================================

CREATE OR REPLACE FUNCTION refund_ai_analysis(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.profiles
  SET ai_analyses_used = GREATEST(ai_analyses_used - 1, 0),
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING ai_analyses_used INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Step 5: Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION consume_ai_analysis(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION refund_ai_analysis(UUID) TO service_role;

-- ============================================================================
-- Step 6: Clean slate for existing users
-- All existing free users start with 0 used (fresh budget of 5)
-- ============================================================================

UPDATE public.profiles
SET ai_analyses_used = 0,
    ai_trial_onboarding_completed = FALSE;

-- ============================================================================
-- Migration Complete
-- ============================================================================

SELECT 'Trial budget system migration completed successfully!' as status;
