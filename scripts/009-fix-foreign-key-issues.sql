-- Check for users in auth.users that don't have profiles
SELECT 
    u.id,
    u.email,
    u.created_at,
    p.id as profile_exists
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Create missing profiles for existing auth users
INSERT INTO public.profiles (id, email, full_name, created_at)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email),
    u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Check for orphaned subscriptions and usage tracking
SELECT 'orphaned_subscriptions' as type, count(*) as count
FROM public.user_subscriptions us
LEFT JOIN public.profiles p ON us.user_id = p.id
WHERE p.id IS NULL

UNION ALL

SELECT 'orphaned_usage_tracking' as type, count(*) as count
FROM public.usage_tracking ut
LEFT JOIN public.profiles p ON ut.user_id = p.id
WHERE p.id IS NULL;

-- Clean up orphaned records
DELETE FROM public.user_subscriptions 
WHERE user_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.usage_tracking 
WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- Ensure all profiles have subscriptions and usage tracking
INSERT INTO public.user_subscriptions (user_id, plan_id, current_period_end, status)
SELECT 
    p.id,
    (SELECT id FROM public.subscription_plans WHERE name = 'Free' LIMIT 1),
    NOW() + INTERVAL '1 year',
    'active'
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions us 
    WHERE us.user_id = p.id AND us.status = 'active'
);

INSERT INTO public.usage_tracking (user_id, applications_count)
SELECT 
    p.id,
    COALESCE((SELECT count(*) FROM public.applications WHERE user_id = p.id), 0)
FROM public.profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM public.usage_tracking ut 
    WHERE ut.user_id = p.id
);
