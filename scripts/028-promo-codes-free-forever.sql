-- Add support for different promo code types including "free forever"
ALTER TABLE public.promo_codes 
ADD COLUMN IF NOT EXISTS code_type text NOT NULL DEFAULT 'trial' 
CHECK (code_type IN ('trial', 'discount', 'free_forever'));

-- Add discount fields for Stripe integration
ALTER TABLE public.promo_codes 
ADD COLUMN IF NOT EXISTS stripe_coupon_id text,
ADD COLUMN IF NOT EXISTS discount_percent integer CHECK (discount_percent >= 0 AND discount_percent <= 100),
ADD COLUMN IF NOT EXISTS discount_amount integer CHECK (discount_amount >= 0),
ADD COLUMN IF NOT EXISTS discount_duration text CHECK (discount_duration IN ('once', 'repeating', 'forever')),
ADD COLUMN IF NOT EXISTS discount_duration_months integer;

-- Update existing codes to be 'trial' type
UPDATE public.promo_codes SET code_type = 'trial' WHERE code_type IS NULL;

-- Insert example free forever codes
INSERT INTO public.promo_codes (
  code, 
  description, 
  code_type,
  plan_name,
  trial_days,
  max_uses,
  active
) VALUES
  ('FREEFOREVER', 'Permanent free access - special promotion', 'free_forever', 'Free', 0, 100, true),
  ('EARLYBIRD', 'Early bird special - free forever', 'free_forever', 'Free', 0, 50, true),
  ('FRIEND100', 'Friends & family - free forever', 'free_forever', 'Free', 0, 100, true)
ON CONFLICT (code) DO NOTHING;

-- Add comment explaining the code types
COMMENT ON COLUMN public.promo_codes.code_type IS 'Type of promo code: trial (free trial period), discount (percentage/amount off via Stripe), free_forever (permanent free plan)';
COMMENT ON COLUMN public.promo_codes.stripe_coupon_id IS 'Stripe coupon ID for discount codes';
COMMENT ON COLUMN public.promo_codes.discount_percent IS 'Percentage discount (0-100) for discount codes';
COMMENT ON COLUMN public.promo_codes.discount_amount IS 'Fixed amount discount in cents for discount codes';
COMMENT ON COLUMN public.promo_codes.discount_duration IS 'How long the discount applies: once, repeating, or forever';
COMMENT ON COLUMN public.promo_codes.discount_duration_months IS 'Number of months for repeating discounts';