-- Check current subscription plans and their Stripe price IDs
SELECT 
  id,
  name,
  price_monthly,
  price_yearly,
  stripe_monthly_price_id,
  stripe_yearly_price_id
FROM subscription_plans
ORDER BY name;

-- If you need to update them, use commands like:
-- UPDATE subscription_plans 
-- SET stripe_monthly_price_id = 'price_XXXXX', 
--     stripe_yearly_price_id = 'price_YYYYY'
-- WHERE name = 'Pro';

-- For AI Coach plan:
-- UPDATE subscription_plans 
-- SET stripe_monthly_price_id = 'price_XXXXX', 
--     stripe_yearly_price_id = 'price_YYYYY'
-- WHERE name = 'AI Coach';