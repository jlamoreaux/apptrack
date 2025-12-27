-- First, ensure we have an AI Coach plan in the subscription_plans table
INSERT INTO public.subscription_plans (
  id,
  name,
  price_monthly,
  price_yearly,
  max_applications,
  features
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001',
  'AI Coach',
  9.99,
  99.99,
  NULL, -- unlimited applications
  '[
    "AI-powered resume analysis",
    "Job fit scoring",
    "Interview preparation",
    "Cover letter generation",
    "Career advice",
    "Unlimited AI features"
  ]'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET 
  name = EXCLUDED.name,
  features = EXCLUDED.features;

-- Grant AI Coach subscription to admin user (Jordan)
-- First, cancel any existing subscriptions for this user
UPDATE public.user_subscriptions
SET 
  status = 'canceled',
  updated_at = now()
WHERE 
  user_id = '07de3fb9-2062-4a83-b0c3-c7bf94dbcbab'
  AND status IN ('active', 'trialing');

-- Create new AI Coach subscription for admin
INSERT INTO public.user_subscriptions (
  user_id,
  plan_id,
  status,
  billing_cycle,
  current_period_start,
  current_period_end,
  stripe_subscription_id,
  stripe_customer_id,
  created_at,
  updated_at,
  cancel_at_period_end
)
VALUES (
  '07de3fb9-2062-4a83-b0c3-c7bf94dbcbab', -- Jordan's user ID
  '550e8400-e29b-41d4-a716-446655440001', -- AI Coach plan ID
  'active',
  'yearly',
  now(),
  now() + interval '1 year',
  'admin_comp_subscription', -- Special subscription ID for admin
  'admin_comp_customer', -- Special customer ID for admin
  now(),
  now(),
  false
);

-- Verify the subscription was created
DO $$
DECLARE
  subscription_count INT;
BEGIN
  SELECT COUNT(*) INTO subscription_count
  FROM public.user_subscriptions us
  JOIN public.subscription_plans sp ON us.plan_id = sp.id
  WHERE us.user_id = '07de3fb9-2062-4a83-b0c3-c7bf94dbcbab'
    AND us.status = 'active'
    AND sp.name = 'AI Coach';
  
  IF subscription_count = 0 THEN
    RAISE EXCEPTION 'Failed to create AI Coach subscription for admin user';
  END IF;
  
  RAISE NOTICE 'Successfully granted AI Coach subscription to admin user';
END $$;