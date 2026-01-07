-- Migration: Add is_active flag to subscription_plans
-- Allows deprecating plans (like Pro) while keeping them for existing subscribers

-- Add is_active column with default true (all existing plans remain active)
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN subscription_plans.is_active IS 'Whether the plan is available for new subscriptions. Inactive plans are hidden from pricing pages but existing subscribers retain access.';

-- Create index for efficient filtering of active plans
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active
ON subscription_plans (is_active)
WHERE is_active = true;

-- Deprecate the Pro plan (keep it for grandfathered users but hide from new signups)
UPDATE subscription_plans
SET is_active = false
WHERE name = 'Pro';
