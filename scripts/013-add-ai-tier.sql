-- Add the new AI tier to subscription plans
INSERT INTO subscription_plans (id, name, price_monthly, price_yearly, max_applications, features, created_at)
VALUES (
  gen_random_uuid(),
  'AI Coach',
  9,
  90,
  -1,
  '["Unlimited applications", "All Pro features", "AI Career Coach", "Resume analysis & optimization", "Interview preparation", "Cover letter generation", "Job description analysis", "Personalized career advice"]'::jsonb,
  NOW()
) ON CONFLICT (name) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_applications = EXCLUDED.max_applications,
  features = EXCLUDED.features,
  updated_at = NOW();

-- Update existing plans to ensure proper ordering
UPDATE subscription_plans 
SET features = '["Up to 5 applications", "Application tracking", "Interview notes", "Contact management"]'::jsonb
WHERE name = 'Free';

UPDATE subscription_plans 
SET features = '["Unlimited applications", "All Free features", "Cancel reminder when hired", "Priority support"]'::jsonb
WHERE name = 'Pro';
