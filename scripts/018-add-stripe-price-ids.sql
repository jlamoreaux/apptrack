-- Add Stripe price ID columns to subscription_plans table
ALTER TABLE subscription_plans 
ADD COLUMN stripe_monthly_price_id TEXT,
ADD COLUMN stripe_yearly_price_id TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscription_plans_monthly_price ON subscription_plans(stripe_monthly_price_id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_yearly_price ON subscription_plans(stripe_yearly_price_id);

-- Update existing plans with placeholder price IDs (you'll need to replace these with actual Stripe price IDs)
UPDATE subscription_plans 
SET 
  stripe_monthly_price_id = 'price_pro_monthly_placeholder',
  stripe_yearly_price_id = 'price_pro_yearly_placeholder'
WHERE name = 'Pro';

UPDATE subscription_plans 
SET 
  stripe_monthly_price_id = 'price_ai_coach_monthly_placeholder',
  stripe_yearly_price_id = 'price_ai_coach_yearly_placeholder'
WHERE name = 'AI Coach';

-- Free plan doesn't need price IDs since it's free
UPDATE subscription_plans 
SET 
  stripe_monthly_price_id = NULL,
  stripe_yearly_price_id = NULL
WHERE name = 'Free'; 