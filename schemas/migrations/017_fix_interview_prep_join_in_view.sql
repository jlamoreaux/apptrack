-- Migration 017: Fix Interview Prep Join in Materialized View
-- The current join is too permissive and can incorrectly attribute interview preps to applications
-- Only match on exact job_url match, not on "has any job description"

-- Drop and recreate the materialized view with fixed join logic
DROP MATERIALIZED VIEW IF EXISTS public.application_ai_analyses CASCADE;

CREATE MATERIALIZED VIEW public.application_ai_analyses AS
SELECT
  a.id as application_id,
  a.user_id,
  COUNT(DISTINCT jf.id)::int as job_fit_count,
  COUNT(DISTINCT cl.id)::int as cover_letter_count,
  COUNT(DISTINCT ip.id)::int as interview_prep_count,
  MAX(jf.created_at) as latest_job_fit,
  MAX(cl.created_at) as latest_cover_letter,
  MAX(ip.created_at) as latest_interview_prep,
  MAX(jf.fit_score) as best_fit_score
FROM public.applications a
LEFT JOIN public.job_fit_analysis jf ON a.id = jf.application_id
LEFT JOIN public.cover_letters cl ON a.id = cl.application_id
LEFT JOIN public.interview_prep ip ON
  -- Only match if job_url exactly matches (conservative approach)
  -- Prevents incorrectly counting interview preps for wrong applications
  ip.user_id = a.user_id
  AND ip.job_url IS NOT NULL
  AND a.role_link IS NOT NULL
  AND ip.job_url = a.role_link
GROUP BY a.id, a.user_id;

-- Recreate the unique index for fast lookups
CREATE UNIQUE INDEX idx_application_ai_analyses_app_id
  ON public.application_ai_analyses(application_id);

-- Recreate index on user_id for filtering by user
CREATE INDEX idx_application_ai_analyses_user_id
  ON public.application_ai_analyses(user_id);

-- Recreate the RLS-enabled view
DROP VIEW IF EXISTS public.user_application_analyses;
CREATE OR REPLACE VIEW public.user_application_analyses AS
SELECT *
FROM public.application_ai_analyses
WHERE user_id = auth.uid();

-- Restore permissions
GRANT SELECT ON public.application_ai_analyses TO authenticated;
GRANT SELECT ON public.user_application_analyses TO authenticated;

-- Add updated comment
COMMENT ON MATERIALIZED VIEW public.application_ai_analyses IS 'Tracks AI analysis counts and latest dates for each application. Interview preps are only counted if job_url matches exactly. Refreshed automatically via triggers.';
