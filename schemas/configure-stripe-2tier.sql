-- Configure Stripe Products for 2-Tier Pricing
-- Run this script after creating your Stripe products and prices

-- First, verify current subscription plans
SELECT id, name, price_monthly, price_yearly, stripe_monthly_price_id, stripe_yearly_price_id
FROM subscription_plans
ORDER BY name;

-- Update AI Coach plan with actual Stripe price IDs
-- IMPORTANT: Replace these placeholder values with your actual Stripe price IDs from the Stripe Dashboard
UPDATE subscription_plans 
SET 
  stripe_monthly_price_id = 'price_REPLACE_WITH_AI_COACH_MONTHLY_ID',  -- Replace this!
  stripe_yearly_price_id = 'price_REPLACE_WITH_AI_COACH_YEARLY_ID',    -- Replace this!
  price_monthly = 9.00,
  price_yearly = 90.00,
  max_applications = -1  -- Unlimited for AI Coach
WHERE name = 'AI Coach';

-- Ensure Free plan has no Stripe IDs and correct limits
UPDATE subscription_plans 
SET 
  stripe_monthly_price_id = NULL,
  stripe_yearly_price_id = NULL,
  price_monthly = 0.00,
  price_yearly = 0.00,
  max_applications = 100
WHERE name = 'Free';

-- Pro plan remains for grandfathered users only
-- Do not modify their existing Stripe price IDs

-- Update plan features
UPDATE subscription_plans
SET features = jsonb_build_array(
  'Unlimited applications',
  'AI-powered resume analysis',
  'Custom cover letter generation', 
  'Interview preparation',
  'Career coaching insights',
  'Priority support',
  'All Free features included'
)
WHERE name = 'AI Coach';

UPDATE subscription_plans
SET features = jsonb_build_array(
  'Up to 100 applications',
  'Application tracking',
  'Status management',
  'Analytics and insights',
  'Export functionality',
  'Email notifications'
)
WHERE name = 'Free';

-- Verify the configuration
SELECT 
  name,
  price_monthly,
  price_yearly,
  max_applications,
  stripe_monthly_price_id IS NOT NULL as has_monthly_price,
  stripe_yearly_price_id IS NOT NULL as has_yearly_price,
  jsonb_array_length(features) as feature_count
FROM subscription_plans
ORDER BY 
  CASE name 
    WHEN 'Free' THEN 1
    WHEN 'AI Coach' THEN 2
    WHEN 'Pro' THEN 3
  END;

-- Important: After running this script
-- 1. Replace the placeholder Stripe price IDs with actual values from your Stripe Dashboard
-- 2. Run: ./scripts/run-schema.sh schemas/configure-stripe-2tier.sql
-- 3. Test checkout flow with both monthly and yearly billing cycles
-- 4. Verify webhook handling for new subscriptions