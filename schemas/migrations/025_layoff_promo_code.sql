-- Insert NEWSTART promo code: free 30-day AI Coach access for laid-off workers
INSERT INTO promo_codes (code, code_type, trial_days, applicable_plans, active, max_uses, description)
VALUES (
  'NEWSTART',
  'premium_free',
  30,
  '["AI Coach"]'::jsonb,
  true,
  NULL,
  'Free 30-day AI Coach access for laid-off workers'
)
ON CONFLICT (code) DO NOTHING;
