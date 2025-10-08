-- Check subscription plans configuration
SELECT 
  id,
  name,
  price_monthly,
  price_yearly,
  stripe_monthly_price_id,
  stripe_yearly_price_id,
  created_at
FROM subscription_plans
ORDER BY name;