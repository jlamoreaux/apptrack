-- Test script to verify AI Coach plan setup
-- Run this to check if everything is configured correctly

-- Check if AI Coach plan exists and has proper configuration
SELECT 
  name,
  price_monthly,
  price_yearly,
  max_applications,
  stripe_monthly_price_id,
  stripe_yearly_price_id,
  features
FROM subscription_plans 
WHERE name = 'AI Coach';

-- Check all plans to see the complete setup
SELECT 
  name,
  price_monthly,
  price_yearly,
  max_applications,
  stripe_monthly_price_id IS NOT NULL as has_monthly_price_id,
  stripe_yearly_price_id IS NOT NULL as has_yearly_price_id,
  array_length(features, 1) as feature_count
FROM subscription_plans 
ORDER BY 
  CASE name 
    WHEN 'Free' THEN 1 
    WHEN 'Pro' THEN 2 
    WHEN 'AI Coach' THEN 3 
    ELSE 4 
  END;

-- Check if any plans are missing price IDs (should only be Free plan)
SELECT 
  name,
  CASE 
    WHEN stripe_monthly_price_id IS NULL AND name != 'Free' THEN 'Missing monthly price ID'
    WHEN stripe_yearly_price_id IS NULL AND name != 'Free' THEN 'Missing yearly price ID'
    ELSE 'OK'
  END as status
FROM subscription_plans 
WHERE name != 'Free';

-- Verify the AI Coach plan has the correct features
SELECT 
  name,
  features
FROM subscription_plans 
WHERE name = 'AI Coach'; 