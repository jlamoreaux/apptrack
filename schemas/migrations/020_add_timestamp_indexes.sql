-- Migration 020: Add composite indexes on timestamp columns
-- This improves query performance for "recent analyses" queries that use ORDER BY created_at

-- Resume analysis: Most common query is getting recent analyses for a user
CREATE INDEX IF NOT EXISTS idx_resume_analysis_user_created
  ON public.resume_analysis(user_id, created_at DESC);

-- Job fit analysis: Most common query is getting recent analyses for a user
CREATE INDEX IF NOT EXISTS idx_job_fit_analysis_user_created
  ON public.job_fit_analysis(user_id, created_at DESC);

-- Cover letters: Most common query is getting recent cover letters for a user
CREATE INDEX IF NOT EXISTS idx_cover_letters_user_created
  ON public.cover_letters(user_id, created_at DESC);

-- Interview prep: Most common query is getting recent preparations for a user
CREATE INDEX IF NOT EXISTS idx_interview_prep_user_created
  ON public.interview_prep(user_id, created_at DESC);

-- Career advice sessions: Most common query is getting recent sessions for a user
CREATE INDEX IF NOT EXISTS idx_career_advice_sessions_user_created
  ON public.career_advice_sessions(user_id, created_at DESC);

-- User resumes: Most common query is getting user's resumes ordered by upload date
CREATE INDEX IF NOT EXISTS idx_user_resumes_user_uploaded
  ON public.user_resumes(user_id, uploaded_at DESC);

-- Comment: These composite indexes support queries like:
-- SELECT * FROM resume_analysis WHERE user_id = ? ORDER BY created_at DESC LIMIT 50;
-- The index can be used for both the WHERE clause and the ORDER BY clause
