-- Add onboarding discount code for new users
-- This gives 20% off for 3 months on any paid plan

INSERT INTO public.promo_codes (
  code, 
  description, 
  code_type,
  plan_name,
  trial_days,
  discount_percent,
  discount_duration,
  discount_duration_months,
  max_uses,
  active,
  stripe_coupon_id  -- You'll need to create this in Stripe
) VALUES (
  'WELCOME20',
  'New user welcome discount - 20% off for 3 months',
  'discount',
  'All Plans',  -- Generic name to indicate it applies to all paid plans
  0,  -- No trial days, just discount
  20,
  'repeating',
  3,
  10000,  -- High limit for all new users
  true,
  null  -- Add your Stripe coupon ID here after creating it
)
ON CONFLICT (code) 
DO UPDATE SET 
  description = EXCLUDED.description,
  discount_percent = EXCLUDED.discount_percent,
  discount_duration_months = EXCLUDED.discount_duration_months,
  active = true;

-- Note: You need to create a corresponding coupon in Stripe Dashboard:
-- 1. Go to Stripe Dashboard > Products > Coupons
-- 2. Create a new coupon with 20% off, duration "repeating", 3 months
-- 3. Update the stripe_coupon_id above with the ID from Stripe