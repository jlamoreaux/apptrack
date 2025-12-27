-- Add column to designate a promo code as the welcome offer
-- Only one code can be the welcome offer at a time

ALTER TABLE public.promo_codes
ADD COLUMN IF NOT EXISTS is_welcome_offer boolean DEFAULT false;

-- Add index for quick lookup of the welcome offer
CREATE INDEX IF NOT EXISTS idx_promo_codes_welcome_offer 
ON public.promo_codes (is_welcome_offer) 
WHERE is_welcome_offer = true AND active = true;

-- Add comment explaining the field
COMMENT ON COLUMN public.promo_codes.is_welcome_offer IS 
'When true, this promo code is displayed as the welcome offer on the onboarding page. Only one code should have this set to true at a time.';

-- Function to ensure only one welcome offer at a time
CREATE OR REPLACE FUNCTION ensure_single_welcome_offer()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting this code as welcome offer, unset all others
  IF NEW.is_welcome_offer = true THEN
    UPDATE public.promo_codes 
    SET is_welcome_offer = false 
    WHERE id != NEW.id AND is_welcome_offer = true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single welcome offer
DROP TRIGGER IF EXISTS ensure_single_welcome_offer_trigger ON public.promo_codes;
CREATE TRIGGER ensure_single_welcome_offer_trigger
BEFORE INSERT OR UPDATE ON public.promo_codes
FOR EACH ROW
EXECUTE FUNCTION ensure_single_welcome_offer();

-- Set WELCOME20 as the default welcome offer if it exists
UPDATE public.promo_codes 
SET is_welcome_offer = true 
WHERE code = 'WELCOME20' AND active = true;