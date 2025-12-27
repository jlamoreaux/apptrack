-- First, drop the existing constraint
ALTER TABLE promo_codes 
DROP CONSTRAINT IF EXISTS promo_codes_code_type_check;

-- Update all free_forever to premium_free
UPDATE promo_codes 
SET code_type = 'premium_free'
WHERE code_type = 'free_forever';

-- Add the new constraint without free_forever
ALTER TABLE promo_codes 
ADD CONSTRAINT promo_codes_code_type_check 
CHECK (code_type IN ('trial', 'discount', 'premium_free'));