-- Add job_description column to applications table
-- This allows AI features to reuse job descriptions across different analyses

-- Add the column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'applications' 
    AND column_name = 'job_description'
  ) THEN
    ALTER TABLE public.applications 
    ADD COLUMN job_description text NULL;
    
    RAISE NOTICE 'Added job_description column to applications table';
  ELSE
    RAISE NOTICE 'job_description column already exists in applications table';
  END IF;
END $$;

-- Create an index on job_description for better search performance
CREATE INDEX IF NOT EXISTS idx_applications_job_description 
ON public.applications 
USING btree (user_id, (job_description IS NOT NULL))
WHERE job_description IS NOT NULL;

-- Update RLS policies if needed (applications table should already have RLS)
-- Users can only see and update their own applications
-- This is already handled by existing RLS policies

-- Verify the column was added
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'applications'
  AND column_name = 'job_description';