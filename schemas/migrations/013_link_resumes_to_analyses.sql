-- Migration 013: Link Resumes to AI Analyses
-- Add user_resume_id foreign keys to all AI analysis tables
-- This allows tracking which resume was used for each analysis

-- Step 1: Add user_resume_id to job_fit_analysis table
ALTER TABLE public.job_fit_analysis
  ADD COLUMN IF NOT EXISTS user_resume_id UUID;

-- Add foreign key constraint with SET NULL on delete
-- (if resume is deleted, analysis remains but resume reference is cleared)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'job_fit_analysis_user_resume_id_fkey'
  ) THEN
    ALTER TABLE public.job_fit_analysis
      ADD CONSTRAINT job_fit_analysis_user_resume_id_fkey
        FOREIGN KEY (user_resume_id)
        REFERENCES public.user_resumes(id)
        ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_job_fit_analysis_user_resume_id
  ON public.job_fit_analysis(user_resume_id);

-- Step 2: Add user_resume_id to cover_letters table
ALTER TABLE public.cover_letters
  ADD COLUMN IF NOT EXISTS user_resume_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'cover_letters_user_resume_id_fkey'
  ) THEN
    ALTER TABLE public.cover_letters
      ADD CONSTRAINT cover_letters_user_resume_id_fkey
        FOREIGN KEY (user_resume_id)
        REFERENCES public.user_resumes(id)
        ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cover_letters_user_resume_id
  ON public.cover_letters(user_resume_id);

-- Step 3: Ensure resume_analysis has proper cascade behavior
-- (This table should already have user_resume_id, but ensure proper constraints)
ALTER TABLE public.resume_analysis
  DROP CONSTRAINT IF EXISTS resume_analysis_user_resume_id_fkey;

ALTER TABLE public.resume_analysis
  ADD CONSTRAINT resume_analysis_user_resume_id_fkey
    FOREIGN KEY (user_resume_id)
    REFERENCES public.user_resumes(id)
    ON DELETE SET NULL;

-- Step 4: Ensure interview_prep has proper cascade behavior
ALTER TABLE public.interview_prep
  DROP CONSTRAINT IF EXISTS interview_prep_user_resume_id_fkey;

ALTER TABLE public.interview_prep
  ADD CONSTRAINT interview_prep_user_resume_id_fkey
    FOREIGN KEY (user_resume_id)
    REFERENCES public.user_resumes(id)
    ON DELETE SET NULL;

-- Step 5: Add helpful comments
COMMENT ON COLUMN public.job_fit_analysis.user_resume_id IS 'Reference to the resume used for this analysis. NULL if resume was deleted or analysis used pasted text.';
COMMENT ON COLUMN public.cover_letters.user_resume_id IS 'Reference to the resume used to generate this cover letter. NULL if resume was deleted or text was pasted.';
COMMENT ON COLUMN public.resume_analysis.user_resume_id IS 'Reference to the resume that was analyzed. NULL if resume was deleted or text was pasted.';
COMMENT ON COLUMN public.interview_prep.user_resume_id IS 'Reference to the resume used for interview preparation. NULL if resume was deleted or text was pasted.';
