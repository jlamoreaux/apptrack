-- Manual Stripe sync script
-- This script helps manually sync a subscription from Stripe to the database
-- Use this for testing or to fix mismatched subscriptions

-- 1. First, check what AI Coach plan ID we have
SELECT 
  id,
  name,
  price_monthly,
  price_yearly,
  stripe_monthly_price_id,
  stripe_yearly_price_id
FROM subscription_plans 
WHERE name ILIKE '%ai%' OR name ILIKE '%coach%';

-- 2. Get the user ID for the specific email
SELECT 
  id,
  user_id,
  email
FROM profiles 
WHERE email = 'jnacious88+local@gmail.com';

-- 3. Manual subscription creation/update
-- Replace the values below with actual data from Stripe
-- You'll need to get these from the Stripe dashboard:
-- - Stripe customer ID (starts with 'cus_')
-- - Stripe subscription ID (starts with 'sub_')
-- - Plan ID (from step 1)
-- - User ID (from step 2)

/*
-- Option A: Update existing subscription (if it exists)
UPDATE user_subscriptions 
SET 
  plan_id = 'PLAN_ID_HERE', -- Replace with AI Coach plan ID
  stripe_customer_id = 'cus_xxx', -- Replace with actual Stripe customer ID
  stripe_subscription_id = 'sub_xxx', -- Replace with actual Stripe subscription ID
  status = 'active',
  billing_cycle = 'monthly', -- or 'yearly' based on Stripe subscription
  current_period_start = '2024-01-01T00:00:00Z', -- Replace with actual start date
  current_period_end = '2024-02-01T00:00:00Z', -- Replace with actual end date
  cancel_at_period_end = false,
  updated_at = NOW()
WHERE user_id = 'USER_ID_HERE'; -- Replace with actual user ID

-- Option B: Create new subscription (if none exists)
INSERT INTO user_subscriptions (
  user_id,
  plan_id,
  stripe_customer_id,
  stripe_subscription_id,
  status,
  billing_cycle,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  created_at,
  updated_at
) VALUES (
  'USER_ID_HERE', -- Replace with actual user ID
  'PLAN_ID_HERE', -- Replace with AI Coach plan ID
  'cus_xxx', -- Replace with actual Stripe customer ID
  'sub_xxx', -- Replace with actual Stripe subscription ID
  'active',
  'monthly', -- or 'yearly' based on Stripe subscription
  '2024-01-01T00:00:00Z', -- Replace with actual start date
  '2024-02-01T00:00:00Z', -- Replace with actual end date
  false,
  NOW(),
  NOW()
);
*/

-- 4. Verify the update/insert worked
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