-- Manual upgrade script for customer who paid but wasn't upgraded
-- Customer: ixoyedesignstudio@gmail.com
-- User ID: 4d0c4e96-bc09-49e1-b7bb-2986aad31224

-- First, let's check what subscription plans are available
SELECT 
  id,
  name,
  price_monthly,
  price_yearly,
  stripe_monthly_price_id,
  stripe_yearly_price_id
FROM subscription_plans
ORDER BY name;

-- Get the Pro plan ID
SELECT id, name FROM subscription_plans WHERE name = 'Pro';

-- Create the subscription manually
-- NOTE: You'll need the stripe_customer_id and stripe_subscription_id from Stripe dashboard
-- For now, we'll create without them since RLS is fixed for future webhooks
INSERT INTO user_subscriptions (
  user_id,
  plan_id,
  status,
  billing_cycle,
  current_period_start,
  current_period_end,
  stripe_customer_id,
  stripe_subscription_id,
  cancel_at_period_end,
  created_at,
  updated_at
) VALUES (
  '4d0c4e96-bc09-49e1-b7bb-2986aad31224', -- user_id for ixoyedesignstudio@gmail.com
  (SELECT id FROM subscription_plans WHERE name = 'Pro'), -- Pro plan ID
  'active', -- active status
  'monthly', -- Change to 'yearly' if they paid for yearly
  NOW(), -- current_period_start
  NOW() + INTERVAL '30 days', -- current_period_end (adjust to 1 year if yearly)
  'cus_TCKRbGMMEP1OR0', -- stripe_customer_id
  'sub_1SFvmbIybeT4i3WVWqgXG6ba', -- stripe_subscription_id
  false, -- cancel_at_period_end
  NOW(), -- created_at
  NOW() -- updated_at
);

-- Verify the subscription was created
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
WHERE us.user_id = '4d0c4e96-bc09-49e1-b7bb-2986aad31224';