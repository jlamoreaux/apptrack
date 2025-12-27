-- Migration: Add application_id column to job_fit_analysis table
-- This allows tracking which application each job fit analysis belongs to

-- Add the application_id column (nullable initially for existing records)
ALTER TABLE public.job_fit_analysis 
ADD COLUMN IF NOT EXISTS application_id uuid;

-- Add the foreign key constraint (PostgreSQL doesn't support IF NOT EXISTS for constraints)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'job_fit_analysis' 
        AND constraint_name = 'job_fit_analysis_application_id_fkey'
    ) THEN
        ALTER TABLE public.job_fit_analysis 
        ADD CONSTRAINT job_fit_analysis_application_id_fkey 
        FOREIGN KEY (application_id) REFERENCES public.applications (id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_job_fit_analysis_application_id 
ON public.job_fit_analysis USING btree (application_id);

-- Update RLS policies to include application_id filtering
-- Users can only view analyses for applications they own
DROP POLICY IF EXISTS "Users can view their own job fit analyses" ON public.job_fit_analysis;
CREATE POLICY "Users can view their own job fit analyses" ON public.job_fit_analysis
  FOR SELECT USING (
    auth.uid() = user_id AND 
    application_id IN (
      SELECT id FROM public.applications WHERE user_id = auth.uid()
    )
  );