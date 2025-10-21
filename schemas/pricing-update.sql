-- Pricing structure update migration
-- This migration updates the database to support the new 2-tier pricing structure

-- 1. Add application_limit column to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS application_limit INTEGER DEFAULT 100;

-- 2. Update existing free users to have 100 application limit
UPDATE users 
SET application_limit = 100 
WHERE id NOT IN (
  SELECT user_id 
  FROM subscriptions 
  WHERE status = 'active'
);

-- 3. Set unlimited (-1) for all paid users
UPDATE users 
SET application_limit = -1 
WHERE id IN (
  SELECT user_id 
  FROM subscriptions 
  WHERE status = 'active'
);

-- 4. Add grandfathered flag to subscriptions metadata
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 5. Create index for faster application counting
CREATE INDEX IF NOT EXISTS idx_applications_user_id_archived 
ON applications(user_id, archived) 
WHERE archived = false;

-- 6. Create a function to check application limits
CREATE OR REPLACE FUNCTION check_application_limit(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_limit INTEGER;
  v_current_count INTEGER;
BEGIN
  -- Get user's application limit
  SELECT application_limit INTO v_limit
  FROM users
  WHERE id = p_user_id;
  
  -- If limit is -1 (unlimited), always allow
  IF v_limit = -1 THEN
    RETURN TRUE;
  END IF;
  
  -- Count current non-archived applications
  SELECT COUNT(*) INTO v_current_count
  FROM applications
  WHERE user_id = p_user_id 
    AND archived = false;
  
  -- Check if under limit
  RETURN v_current_count < v_limit;
END;
$$ LANGUAGE plpgsql;

-- 7. Create a trigger to enforce application limits on insert
CREATE OR REPLACE FUNCTION enforce_application_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT check_application_limit(NEW.user_id) THEN
    RAISE EXCEPTION 'Application limit reached. Please upgrade to continue tracking applications.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS check_application_limit_trigger ON applications;

CREATE TRIGGER check_application_limit_trigger
BEFORE INSERT ON applications
FOR EACH ROW
EXECUTE FUNCTION enforce_application_limit();

-- 8. Add RLS policy for application limit
CREATE POLICY "Users can see their own application limit"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 9. Create view for subscription status with grandfathered info
CREATE OR REPLACE VIEW subscription_status AS
SELECT 
  s.user_id,
  s.plan_name,
  s.status,
  s.current_period_end,
  s.metadata->>'grandfathered' as is_grandfathered,
  s.metadata->>'original_plan' as original_plan,
  u.application_limit,
  CASE 
    WHEN s.plan_name = 'Pro' AND s.metadata->>'grandfathered' = 'true' THEN 'Pro (Grandfathered)'
    ELSE s.plan_name
  END as display_plan_name
FROM subscriptions s
JOIN users u ON u.id = s.user_id
WHERE s.status = 'active';

-- Grant access to the view
GRANT SELECT ON subscription_status TO authenticated;