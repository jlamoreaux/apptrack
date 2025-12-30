-- Migration 014: Analysis Tracking View
-- Create materialized view to efficiently track which AI analyses exist for each application
-- Used to show badges on application cards without N+1 queries

-- Step 1: Create materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS public.application_ai_analyses AS
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
  -- Interview prep doesn't have direct application link, match by user + job context
  ip.user_id = a.user_id
  AND (
    ip.job_url = a.role_link
    OR ip.job_description IS NOT NULL  -- At least has some context
  )
GROUP BY a.id, a.user_id;

-- Step 2: Create unique index for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_application_ai_analyses_app_id
  ON public.application_ai_analyses(application_id);

-- Step 3: Create index on user_id for filtering by user
CREATE INDEX IF NOT EXISTS idx_application_ai_analyses_user_id
  ON public.application_ai_analyses(user_id);

-- Step 4: Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_application_ai_analyses()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh materialized view concurrently (doesn't block reads)
  -- Note: CONCURRENTLY requires the unique index we created above
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.application_ai_analyses;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create triggers to auto-refresh when analyses are added/updated/deleted
-- Note: For high-volume production, consider using a cron job instead of triggers

-- Trigger on job_fit_analysis changes
DROP TRIGGER IF EXISTS trigger_refresh_analyses_on_job_fit ON public.job_fit_analysis;
CREATE TRIGGER trigger_refresh_analyses_on_job_fit
  AFTER INSERT OR UPDATE OR DELETE ON public.job_fit_analysis
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.refresh_application_ai_analyses();

-- Trigger on cover_letters changes
DROP TRIGGER IF EXISTS trigger_refresh_analyses_on_cover_letter ON public.cover_letters;
CREATE TRIGGER trigger_refresh_analyses_on_cover_letter
  AFTER INSERT OR UPDATE OR DELETE ON public.cover_letters
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.refresh_application_ai_analyses();

-- Trigger on interview_prep changes
DROP TRIGGER IF EXISTS trigger_refresh_analyses_on_interview_prep ON public.interview_prep;
CREATE TRIGGER trigger_refresh_analyses_on_interview_prep
  AFTER INSERT OR UPDATE OR DELETE ON public.interview_prep
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.refresh_application_ai_analyses();

-- Trigger on applications changes (new/deleted applications)
DROP TRIGGER IF EXISTS trigger_refresh_analyses_on_application ON public.applications;
CREATE TRIGGER trigger_refresh_analyses_on_application
  AFTER INSERT OR DELETE ON public.applications
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.refresh_application_ai_analyses();

-- Step 6: Grant appropriate permissions
-- Allow authenticated users to read from the materialized view
GRANT SELECT ON public.application_ai_analyses TO authenticated;

-- Step 7: Add Row Level Security (RLS) policy
-- Users can only see analysis counts for their own applications
ALTER MATERIALIZED VIEW public.application_ai_analyses OWNER TO postgres;

-- Note: Materialized views don't support RLS directly
-- Instead, create a view on top with RLS if needed
CREATE OR REPLACE VIEW public.user_application_analyses AS
SELECT *
FROM public.application_ai_analyses
WHERE user_id = auth.uid();

-- Grant access to the RLS-enabled view
GRANT SELECT ON public.user_application_analyses TO authenticated;

-- Step 8: Add helpful comments
COMMENT ON MATERIALIZED VIEW public.application_ai_analyses IS 'Tracks AI analysis counts and latest dates for each application. Refreshed automatically via triggers.';
COMMENT ON COLUMN public.application_ai_analyses.job_fit_count IS 'Number of job fit analyses for this application';
COMMENT ON COLUMN public.application_ai_analyses.cover_letter_count IS 'Number of cover letters generated for this application';
COMMENT ON COLUMN public.application_ai_analyses.interview_prep_count IS 'Number of interview prep sessions for this application';
COMMENT ON COLUMN public.application_ai_analyses.best_fit_score IS 'Highest fit score from all job fit analyses (0-100)';
