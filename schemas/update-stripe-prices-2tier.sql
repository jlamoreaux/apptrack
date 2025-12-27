-- Update Stripe price IDs for 2-tier pricing structure
-- This script configures the AI Coach plan with proper Stripe price IDs

-- First, check current plans
SELECT id, name, price_monthly, price_yearly, stripe_monthly_price_id, stripe_yearly_price_id
FROM subscription_plans
ORDER BY name;

-- Update AI Coach plan with actual Stripe price IDs
-- NOTE: Replace these placeholders with your actual Stripe price IDs
UPDATE subscription_plans 
SET 
  stripe_monthly_price_id = 'price_ai_coach_monthly_REPLACE_ME',
  stripe_yearly_price_id = 'price_ai_coach_yearly_REPLACE_ME',
  price_monthly = 9.00,
  price_yearly = 90.00  -- $90/year (2 months free)
WHERE name = 'AI Coach';

-- Ensure Free plan has no Stripe price IDs (it's free)
UPDATE subscription_plans 
SET 
  stripe_monthly_price_id = NULL,
  stripe_yearly_price_id = NULL,
  price_monthly = 0.00,
  price_yearly = 0.00
WHERE name = 'Free';

-- Keep Pro plan for existing grandfathered users
-- Their existing Stripe price IDs remain unchanged

-- Verify the updates
SELECT id, name, price_monthly, price_yearly, stripe_monthly_price_id, stripe_yearly_price_id
FROM subscription_plans
ORDER BY name;

-- Update features for AI Coach plan if needed
UPDATE subscription_plans
SET features = jsonb_build_array(
  'Unlimited applications',
  'AI-powered resume analysis',
  'Custom cover letter generation', 
  'Interview preparation',
  'Career coaching insights',
  'All Free features included'
)
WHERE name = 'AI Coach';

-- Update features for Free plan
UPDATE subscription_plans
SET features = jsonb_build_array(
  'Up to 100 applications',
  'Application tracking',
  'Status management',
  'Basic analytics',
  'Export functionality'
),
max_applications = 100
WHERE name = 'Free';