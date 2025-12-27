-- Debug Stripe IDs in user_subscriptions
-- This script helps diagnose if Stripe customer and subscription IDs are being saved

-- 1. Check if we have any subscriptions with Stripe IDs
SELECT 
  'Subscriptions with Stripe customer IDs' as check_type,
  COUNT(*) as count
FROM user_subscriptions 
WHERE stripe_customer_id IS NOT NULL AND stripe_customer_id != '';

SELECT 
  'Subscriptions with Stripe subscription IDs' as check_type,
  COUNT(*) as count
FROM user_subscriptions 
WHERE stripe_subscription_id IS NOT NULL AND stripe_subscription_id != '';

-- 2. Show all subscriptions with their Stripe IDs
SELECT 
  us.id,
  us.user_id,
  sp.name as plan_name,
  us.status,
  us.billing_cycle,
  us.stripe_customer_id,
  us.stripe_subscription_id,
  us.current_period_start,
  us.current_period_end,
  us.cancel_at_period_end,
  us.created_at,
  p.email
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
LEFT JOIN profiles p ON us.user_id = p.id
ORDER BY us.created_at DESC;

-- 3. Check for subscriptions without Stripe IDs (these might be free plans or test data)
SELECT 
  us.id,
  us.user_id,
  sp.name as plan_name,
  us.status,
  us.stripe_customer_id,
  us.stripe_subscription_id,
  us.created_at,
  p.email
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
LEFT JOIN profiles p ON us.user_id = p.id
WHERE (us.stripe_customer_id IS NULL OR us.stripe_customer_id = '')
   OR (us.stripe_subscription_id IS NULL OR us.stripe_subscription_id = '')
ORDER BY us.created_at DESC;

-- 4. Check for duplicate Stripe subscription IDs (should be 0)
SELECT 
  us.stripe_subscription_id,
  COUNT(*) as count,
  STRING_AGG(us.id::text, ', ') as subscription_ids
FROM user_subscriptions us
WHERE us.stripe_subscription_id IS NOT NULL AND us.stripe_subscription_id != ''
GROUP BY us.stripe_subscription_id
HAVING COUNT(*) > 1;

-- 5. Check for duplicate Stripe customer IDs (users might have multiple subscriptions)
SELECT 
  us.stripe_customer_id,
  COUNT(*) as count,
  STRING_AGG(us.id::text, ', ') as subscription_ids
FROM user_subscriptions us
WHERE us.stripe_customer_id IS NOT NULL AND us.stripe_customer_id != ''
GROUP BY us.stripe_customer_id
HAVING COUNT(*) > 1;

-- 6. Show the most recent subscriptions (last 10)
SELECT 
  us.id,
  us.user_id,
  sp.name as plan_name,
  us.status,
  us.billing_cycle,
  us.stripe_customer_id,
  us.stripe_subscription_id,
  us.created_at,
  p.email
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
LEFT JOIN profiles p ON us.user_id = p.id
ORDER BY us.created_at DESC
LIMIT 10;

-- 7. Check if there are any subscriptions created in the last 24 hours
SELECT 
  us.id,
  us.user_id,
  sp.name as plan_name,
  us.status,
  us.stripe_customer_id,
  us.stripe_subscription_id,
  us.created_at,
  p.email
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
LEFT JOIN profiles p ON us.user_id = p.id
WHERE us.created_at >= NOW() - INTERVAL '24 hours'
ORDER BY us.created_at DESC; 