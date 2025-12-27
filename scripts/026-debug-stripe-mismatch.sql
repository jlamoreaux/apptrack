-- Debug Stripe vs Database mismatch for specific user
-- This script helps identify why a user shows as Free in DB but AI Coach in Stripe

-- 1. Check the specific user's subscription details
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
  us.updated_at,
  p.email
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
LEFT JOIN profiles p ON us.user_id = p.id
WHERE p.email = 'jnacious88+local@gmail.com'
ORDER BY us.created_at DESC;

-- 2. Check if there are multiple subscriptions for this user
SELECT 
  COUNT(*) as subscription_count
FROM user_subscriptions us
LEFT JOIN profiles p ON us.user_id = p.id
WHERE p.email = 'jnacious88+local@gmail.com';

-- 3. Check the user's profile details
SELECT 
  id,
  user_id,
  full_name,
  created_at,
  updated_at
FROM profiles 
WHERE id IN (
  SELECT user_id 
  FROM user_subscriptions us
  LEFT JOIN profiles p ON us.user_id = p.id
  WHERE p.email = 'jnacious88+local@gmail.com'
);

-- 4. Check if there are any subscription plans with AI Coach name
SELECT 
  id,
  name,
  price_monthly,
  price_yearly,
  max_applications,
  stripe_monthly_price_id,
  stripe_yearly_price_id
FROM subscription_plans 
WHERE name ILIKE '%ai%' OR name ILIKE '%coach%';

-- 5. Check all subscription plans
SELECT 
  id,
  name,
  price_monthly,
  price_yearly,
  max_applications,
  stripe_monthly_price_id,
  stripe_yearly_price_id
FROM subscription_plans 
ORDER BY name;

-- 6. Check for any webhook-related errors in the logs (if you have a logs table)
-- This would help identify if webhooks are failing

-- 7. Check if there are any subscriptions with this user's Stripe customer ID
-- You'll need to get the Stripe customer ID from Stripe dashboard first
-- Replace 'cus_xxx' with the actual Stripe customer ID
/*
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
WHERE us.stripe_customer_id = 'cus_xxx'; -- Replace with actual Stripe customer ID
*/ 