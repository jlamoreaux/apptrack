-- Comprehensive check for Resume Roast setup in Supabase

-- 1. Check if pg_cron extension is enabled
SELECT 
  EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') as "pg_cron_enabled";

-- 2. Check if the cron job exists and is active
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active THEN '✅ Active'
    ELSE '❌ Inactive'
  END as status
FROM cron.job
WHERE jobname = 'cleanup-expired-roasts';

-- 3. Check if the cleanup function exists
SELECT 
  EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
    AND p.proname = 'cleanup_expired_roasts'
  ) as "cleanup_function_exists";

-- 4. Count current roasts and expired roasts
SELECT 
  COUNT(*) as total_roasts,
  COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_roasts,
  COUNT(*) FILTER (WHERE expires_at >= NOW()) as active_roasts
FROM public.roasts;

-- 5. Show next 5 roasts that will expire
SELECT 
  shareable_id,
  first_name,
  created_at,
  expires_at,
  expires_at - NOW() as time_until_expiry
FROM public.roasts
WHERE expires_at >= NOW()
ORDER BY expires_at ASC
LIMIT 5;

-- 6. Check if cleanup_logs table exists
SELECT 
  EXISTS(
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'cleanup_logs'
  ) as "cleanup_logs_table_exists";