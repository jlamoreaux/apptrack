-- Update the welcome offer to be 20% off for 3 months
UPDATE promo_codes 
SET 
  discount_duration_months = 3
WHERE 
  is_welcome_offer = true 
  AND discount_duration = 'repeating';