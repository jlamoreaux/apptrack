-- Check if tables exist and have data
SELECT 'profiles' as table_name, count(*) as row_count FROM public.profiles
UNION ALL
SELECT 'subscription_plans' as table_name, count(*) as row_count FROM public.subscription_plans
UNION ALL
SELECT 'user_subscriptions' as table_name, count(*) as row_count FROM public.user_subscriptions
UNION ALL
SELECT 'usage_tracking' as table_name, count(*) as row_count FROM public.usage_tracking
UNION ALL
SELECT 'applications' as table_name, count(*) as row_count FROM public.applications;

-- Check if subscription plans exist
SELECT * FROM public.subscription_plans;

-- Check for any hanging transactions or locks
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes'
AND state != 'idle';

-- Check triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Temporarily disable the trigger to test if it's causing issues
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

-- Re-enable it after testing
-- ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
