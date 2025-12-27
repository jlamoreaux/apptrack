-- Debug script to check user creation issues
-- Run this to diagnose why new users aren't being created in profiles table

-- 1. Check if the trigger exists and is enabled
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 2. Check if the function exists
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- 3. Check recent auth.users vs profiles
SELECT 
    'auth.users count' as table_name,
    count(*) as count
FROM auth.users
UNION ALL
SELECT 
    'profiles count' as table_name,
    count(*) as count
FROM public.profiles;

-- 4. Check for users without profiles (this should be empty if trigger works)
SELECT 
    u.id,
    u.email,
    u.created_at,
    p.id as profile_exists
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ORDER BY u.created_at DESC
LIMIT 10;

-- 5. Check for profiles without auth users (orphaned profiles)
SELECT 
    p.id,
    p.email,
    p.created_at,
    u.id as auth_user_exists
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL
ORDER BY p.created_at DESC
LIMIT 10;

-- 6. Check if subscription_plans table has the Free plan
SELECT 
    name,
    id,
    price_monthly,
    price_yearly
FROM subscription_plans 
WHERE name = 'Free';

-- 7. Check recent user subscriptions
SELECT 
    us.user_id,
    us.status,
    us.created_at,
    p.email
FROM user_subscriptions us
LEFT JOIN profiles p ON us.user_id = p.id
ORDER BY us.created_at DESC
LIMIT 10;

-- 8. Check if RLS policies might be blocking the trigger
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'profiles';

-- 9. Test the trigger function manually (replace with a test user ID)
-- This will help identify if the function works but the trigger doesn't
-- SELECT public.handle_new_user();

-- 10. Check for any recent errors in the logs
-- (This would need to be checked in Supabase dashboard) 