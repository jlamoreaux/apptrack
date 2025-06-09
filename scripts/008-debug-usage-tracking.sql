-- Check current user's subscription and usage
SELECT 
    p.email,
    us.status as subscription_status,
    sp.name as plan_name,
    sp.max_applications,
    ut.applications_count,
    (SELECT count(*) FROM applications WHERE user_id = p.id) as actual_app_count
FROM profiles p
LEFT JOIN user_subscriptions us ON p.id = us.user_id AND us.status = 'active'
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
LEFT JOIN usage_tracking ut ON p.id = ut.user_id
ORDER BY p.created_at DESC;

-- Check if there are orphaned usage tracking records
SELECT 
    ut.user_id,
    ut.applications_count,
    (SELECT count(*) FROM applications WHERE user_id = ut.user_id) as actual_count,
    (SELECT email FROM profiles WHERE id = ut.user_id) as email
FROM usage_tracking ut;

-- Reset usage tracking to match actual application counts
UPDATE usage_tracking 
SET applications_count = (
    SELECT count(*) 
    FROM applications 
    WHERE applications.user_id = usage_tracking.user_id
),
last_updated = NOW();

-- Ensure all users have proper subscription setup
INSERT INTO user_subscriptions (user_id, plan_id, current_period_end, status)
SELECT 
    p.id,
    (SELECT id FROM subscription_plans WHERE name = 'Free' LIMIT 1),
    NOW() + INTERVAL '1 year',
    'active'
FROM profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM user_subscriptions us 
    WHERE us.user_id = p.id AND us.status = 'active'
);

-- Ensure all users have usage tracking
INSERT INTO usage_tracking (user_id, applications_count)
SELECT 
    p.id,
    COALESCE((SELECT count(*) FROM applications WHERE user_id = p.id), 0)
FROM profiles p
WHERE NOT EXISTS (
    SELECT 1 FROM usage_tracking ut 
    WHERE ut.user_id = p.id
);
