-- Migration: Add job_description column to applications table
-- This allows storing job descriptions with applications for reuse in AI features
-- Created: 2025-09-15

-- Add the job_description column (nullable for existing records)
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS job_description text;

-- Add index for performance when searching/filtering
CREATE INDEX IF NOT EXISTS idx_applications_job_description 
ON public.applications USING gin (to_tsvector('english', job_description))
WHERE job_description IS NOT NULL;

-- Update the updated_at trigger will automatically handle timestamp updates

-- Note: Existing applications will have NULL job_description
-- Users can add job descriptions when editing applications or they'll be prompted when using AI features