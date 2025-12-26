-- Add the new AI tier to subscription plans
-- First, check if the plan already exists and delete it if it does
DELETE FROM subscription_plans WHERE name = 'AI Coach';

-- Insert the new AI Coach plan
INSERT INTO subscription_plans (id, name, price_monthly, price_yearly, max_applications, features, created_at)
VALUES (
  gen_random_uuid(),
  'AI Coach',
  9,
  90,
  -1,
  '["Unlimited applications", "All Pro features", "AI Career Coach", "Resume analysis & optimization", "Interview preparation", "Cover letter generation", "Job description analysis", "Personalized career advice"]'::jsonb,
  NOW()
);

-- Update existing plans to ensure proper ordering
UPDATE subscription_plans
SET features = '["Up to 100 applications", "Application tracking", "Interview notes", "Contact management"]'::jsonb
WHERE name = 'Free';

UPDATE subscription_plans 
SET features = '["Unlimited applications", "All Free features", "Cancel reminder when hired", "Priority support"]'::jsonb
WHERE name = 'Pro';
