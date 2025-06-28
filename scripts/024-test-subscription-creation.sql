-- Test subscription creation with correct schema
-- This script tests the subscription creation process

-- 1. Check if we have subscription plans
SELECT 'subscription_plans' as table_name, count(*) as row_count FROM subscription_plans;

-- 2. Show the subscription plans
SELECT id, name, price_monthly, price_yearly, max_applications FROM subscription_plans;

-- 3. Check if we have any existing subscriptions
SELECT 'user_subscriptions' as table_name, count(*) as row_count FROM user_subscriptions;

-- 4. Show existing subscriptions with plan names
SELECT 
  us.id,
  us.user_id,
  us.plan_id,
  sp.name as plan_name,
  us.status,
  us.billing_cycle,
  us.stripe_subscription_id,
  us.stripe_customer_id,
  us.current_period_start,
  us.current_period_end,
  us.cancel_at_period_end,
  us.created_at
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
ORDER BY us.created_at DESC;

-- 5. Test creating a subscription manually (replace with actual user_id and plan_id)
-- This is just for testing - in production this would be done via Stripe webhook
/*
INSERT INTO user_subscriptions (
  user_id,
  plan_id,
  status,
  billing_cycle,
  current_period_start,
  current_period_end,
  stripe_subscription_id,
  stripe_customer_id,
  cancel_at_period_end
) VALUES (
  'your-user-id-here',
  (SELECT id FROM subscription_plans WHERE name = 'Pro' LIMIT 1),
  'active',
  'monthly',
  NOW(),
  NOW() + INTERVAL '1 month',
  'test_subscription_id',
  'test_customer_id',
  false
);
*/

-- 6. Verify the subscription was created correctly
SELECT 
  us.id,
  us.user_id,
  us.plan_id,
  sp.name as plan_name,
  us.status,
  us.billing_cycle,
  us.stripe_subscription_id,
  us.stripe_customer_id,
  us.current_period_start,
  us.current_period_end,
  us.cancel_at_period_end,
  us.created_at
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
ORDER BY us.created_at DESC;

-- Check current subscription status with plan names
SELECT 
  us.id,
  us.user_id,
  sp.name as plan_name,
  us.status,
  us.billing_cycle,
  us.stripe_subscription_id,
  us.stripe_customer_id,
  us.current_period_start,
  us.current_period_end,
  us.created_at,
  p.email
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
LEFT JOIN profiles p ON us.user_id = p.id
ORDER BY us.created_at DESC
LIMIT 10;

-- Check plan distribution
SELECT 
  sp.name as plan_name,
  us.status,
  us.billing_cycle,
  COUNT(*) as count
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
GROUP BY sp.name, us.status, us.billing_cycle
ORDER BY sp.name, us.status, us.billing_cycle;

-- Check for users with multiple subscriptions (should be 0 for active users)
SELECT 
  us.user_id,
  COUNT(*) as subscription_count,
  STRING_AGG(sp.name, ', ') as plans
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
GROUP BY us.user_id
HAVING COUNT(*) > 1
ORDER BY subscription_count DESC;

-- Check for subscriptions without associated profiles (should be 0)
SELECT 
  us.id,
  us.user_id,
  sp.name as plan_name,
  us.status
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
LEFT JOIN profiles p ON us.user_id = p.id
WHERE p.id IS NULL;

-- Check for subscriptions without Stripe customer IDs (paid plans should have these)
SELECT 
  us.id,
  us.user_id,
  sp.name as plan_name,
  us.status,
  us.stripe_customer_id
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE sp.name != 'Free' 
  AND (us.stripe_customer_id IS NULL OR us.stripe_customer_id = '');

-- Check for orphaned subscriptions (plan_id that doesn't exist in subscription_plans)
SELECT 
  us.id,
  us.user_id,
  us.plan_id,
  us.status
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE sp.id IS NULL; 