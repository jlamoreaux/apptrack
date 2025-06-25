-- Add new fields for deduplication and context to interview_prep
ALTER TABLE interview_prep
  ADD COLUMN user_resume_id uuid,
  ADD COLUMN resume_text text,
  ADD COLUMN job_url text,
  ADD COLUMN user_background text;

-- (Optional) Add indexes for deduplication performance
CREATE INDEX IF NOT EXISTS idx_interview_prep_user_resume_id ON interview_prep(user_resume_id);
CREATE INDEX IF NOT EXISTS idx_interview_prep_job_url ON interview_prep(job_url); 