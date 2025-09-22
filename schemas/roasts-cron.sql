-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on pg_cron to postgres user (if needed)
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create or replace the function to delete expired roasts
CREATE OR REPLACE FUNCTION public.cleanup_expired_roasts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete roasts that have expired
  WITH deleted AS (
    DELETE FROM public.roasts
    WHERE expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  -- Log the cleanup (optional - you can create a cleanup_logs table if you want to track this)
  RAISE NOTICE 'Cleaned up % expired roasts at %', deleted_count, NOW();
  
  -- You could also insert into a log table here if you want to track cleanup history
  -- INSERT INTO cleanup_logs (table_name, deleted_count, cleaned_at)
  -- VALUES ('roasts', deleted_count, NOW());
END;
$$;

-- Remove existing cron job if it exists (to avoid duplicates)
SELECT cron.unschedule('cleanup-expired-roasts') 
WHERE EXISTS (
  SELECT 1 FROM cron.job 
  WHERE jobname = 'cleanup-expired-roasts'
);

-- Schedule the cleanup to run daily at 3 AM UTC
SELECT cron.schedule(
  'cleanup-expired-roasts',           -- job name
  '0 3 * * *',                        -- cron expression: daily at 3 AM UTC
  'SELECT public.cleanup_expired_roasts();'  -- SQL command to run
);

-- Optional: Create a cleanup log table to track cleanup history
CREATE TABLE IF NOT EXISTS public.cleanup_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  deleted_count INTEGER NOT NULL DEFAULT 0,
  cleaned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Create index on cleanup logs for efficient querying
CREATE INDEX IF NOT EXISTS idx_cleanup_logs_cleaned_at 
ON public.cleanup_logs(cleaned_at DESC);

-- Grant appropriate permissions
GRANT SELECT, INSERT ON public.cleanup_logs TO authenticated;
GRANT SELECT ON public.cleanup_logs TO anon;

-- Add RLS policy for cleanup logs (read-only for everyone, insert only by system)
ALTER TABLE public.cleanup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cleanup logs are viewable by authenticated users" ON public.cleanup_logs
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Add comment to document the cron job
COMMENT ON FUNCTION public.cleanup_expired_roasts() IS 'Cleans up expired roasts (30+ days old). Scheduled to run daily at 3 AM UTC via pg_cron.';