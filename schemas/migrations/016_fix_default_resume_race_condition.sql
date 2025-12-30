-- Migration 016: Fix Race Condition in Default Resume Trigger
-- Add row-level locking to prevent concurrent default resume modifications

-- Drop and recreate the trigger function with proper locking
CREATE OR REPLACE FUNCTION public.enforce_one_default_resume()
RETURNS TRIGGER AS $$
BEGIN
  -- When setting a resume as default, lock all user's resumes to prevent race conditions
  IF NEW.is_default = true THEN
    -- Lock all user's resumes for this transaction to prevent concurrent modifications
    -- This prevents TOCTOU (Time-of-check to time-of-use) race conditions where
    -- two concurrent requests could both try to set different resumes as default
    PERFORM 1 FROM public.user_resumes
    WHERE user_id = NEW.user_id
    FOR UPDATE;

    -- Now safely unset all other defaults for this user
    UPDATE public.user_resumes
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND is_default = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger itself doesn't need to be recreated, but we'll do it for clarity
DROP TRIGGER IF EXISTS trigger_enforce_one_default_resume ON public.user_resumes;
CREATE TRIGGER trigger_enforce_one_default_resume
  BEFORE INSERT OR UPDATE ON public.user_resumes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_one_default_resume();
