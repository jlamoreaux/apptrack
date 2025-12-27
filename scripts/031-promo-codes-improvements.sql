-- Improve promo codes table to support multiple plans and better Stripe integration

-- First, remove the old constraint
ALTER TABLE public.promo_codes 
DROP CONSTRAINT IF EXISTS promo_codes_plan_check;

-- Add new columns for better functionality
ALTER TABLE public.promo_codes
ADD COLUMN IF NOT EXISTS applicable_plans jsonb DEFAULT '["All Plans"]'::jsonb,
ADD COLUMN IF NOT EXISTS stripe_promotion_code_id text; -- Stripe promotion code ID (different from coupon ID)

-- Update existing rows to use the new applicable_plans format
UPDATE public.promo_codes
SET applicable_plans = 
  CASE 
    WHEN plan_name = 'All Plans' THEN '["Pro", "AI Coach"]'::jsonb
    ELSE jsonb_build_array(plan_name)
  END
WHERE applicable_plans IS NULL OR applicable_plans = '["All Plans"]'::jsonb;

-- Add comment explaining the new fields
COMMENT ON COLUMN public.promo_codes.applicable_plans IS 'Array of plan names this code applies to. Empty array or ["All Plans"] means all paid plans.';
COMMENT ON COLUMN public.promo_codes.stripe_promotion_code_id IS 'Stripe promotion code ID (different from coupon ID). This is the ID returned when creating a promotion code in Stripe.';
COMMENT ON COLUMN public.promo_codes.plan_name IS 'DEPRECATED - Use applicable_plans instead. Kept for backward compatibility.';

-- Create an index for better performance on applicable_plans
CREATE INDEX IF NOT EXISTS idx_promo_codes_applicable_plans 
ON public.promo_codes USING gin (applicable_plans);

-- Update the WELCOME20 code to apply to all paid plans
UPDATE public.promo_codes
SET applicable_plans = '["Pro", "AI Coach"]'::jsonb
WHERE code = 'WELCOME20';

-- Example of setting a Stripe coupon ID (you'll need to update with your actual IDs)
-- UPDATE public.promo_codes
-- SET stripe_coupon_id = 'your_stripe_coupon_id',
--     stripe_promotion_code_id = 'your_stripe_promotion_code_id'
-- WHERE code = 'WELCOME20';