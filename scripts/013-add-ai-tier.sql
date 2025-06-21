-- Add the new AI tier to subscription plans
INSERT INTO subscription_plans (id, name, price_monthly, price_yearly, max_applications, features, created_at)
VALUES (
  gen_random_uuid(),
  'AI Coach',
  9,
  90,
  -1,
  ARRAY[
    'Unlimited applications',
    'All Pro features',
    'AI Career Coach',
    'Resume analysis & optimization',
    'Interview preparation',
    'Cover letter generation',
    'Job description analysis',
    'Personalized career advice'
  ],
  NOW()
) ON CONFLICT (name) DO UPDATE SET
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_applications = EXCLUDED.max_applications,
  features = EXCLUDED.features,
  updated_at = NOW();

-- Update existing plans to ensure proper ordering
UPDATE subscription_plans 
SET features = ARRAY[
  'Up to 5 applications',
  'Application tracking',
  'Interview notes',
  'Contact management'
]
WHERE name = 'Free';

UPDATE subscription_plans 
SET features = ARRAY[
  'Unlimited applications',
  'All Free features',
  'Cancel reminder when hired',
  'Priority support'
]
WHERE name = 'Pro';
