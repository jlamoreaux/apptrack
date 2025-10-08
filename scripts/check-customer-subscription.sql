-- Check subscription status for a specific customer

-- 1. Find the user by email and show their profile
SELECT 
  p.id as user_id,
  p.email,
  p.created_at as user_created_at
FROM profiles p
WHERE p.email = 'some-email-address';

-- 2. Check all subscriptions for this user
SELECT 
  us.id as subscription_id,
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
  us.updated_at
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.user_id = (SELECT id FROM profiles WHERE email = 'some-email-address')
ORDER BY us.created_at DESC;

-- 3. Check if there are any active subscriptions
SELECT 
  'Active subscriptions' as check_type,
  COUNT(*) as count
FROM user_subscriptions us
WHERE us.user_id = (SELECT id FROM profiles WHERE email = 'some-email-address')
  AND us.status IN ('active', 'trialing');

-- 4. Check the most recent subscription details with plan info
SELECT 
  us.*,
  sp.name as plan_name,
  sp.price_monthly,
  sp.price_yearly,
  sp.stripe_monthly_price_id,
  sp.stripe_yearly_price_id
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.user_id = (SELECT id FROM profiles WHERE email = 'some-email-address')
ORDER BY us.created_at DESC
LIMIT 1;

-- 5. Check if user has any Stripe IDs associated
SELECT 
  CASE 
    WHEN stripe_customer_id IS NOT NULL THEN 'Has Stripe Customer ID'
    ELSE 'Missing Stripe Customer ID'
  END as stripe_customer_status,
  CASE 
    WHEN stripe_subscription_id IS NOT NULL THEN 'Has Stripe Subscription ID'
    ELSE 'Missing Stripe Subscription ID'
  END as stripe_subscription_status,
  stripe_customer_id,
  stripe_subscription_id
FROM user_subscriptions
WHERE user_id = (SELECT id FROM profiles WHERE email = 'some-email-address')
ORDER BY created_at DESC
LIMIT 1;
