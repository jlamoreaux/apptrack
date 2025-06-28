-- Fix subscription plan names
-- This script fixes any subscriptions that have planId UUIDs instead of plan names

-- First, let's see what we're working with
SELECT 
  us.id,
  us.user_id,
  us.plan_name,
  us.status,
  us.created_at,
  CASE 
    WHEN us.plan_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
    THEN 'UUID (needs fixing)'
    ELSE 'Plan name (correct)'
  END as plan_name_status
FROM user_subscriptions us
ORDER BY us.created_at DESC;

-- Update subscriptions that have UUIDs as plan_name
UPDATE user_subscriptions 
SET plan_name = sp.name
FROM subscription_plans sp
WHERE user_subscriptions.plan_name = sp.id::text
  AND user_subscriptions.plan_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Verify the fix
SELECT 
  us.id,
  us.user_id,
  us.plan_name,
  us.status,
  us.created_at,
  CASE 
    WHEN us.plan_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
    THEN 'UUID (still needs fixing)'
    ELSE 'Plan name (correct)'
  END as plan_name_status
FROM user_subscriptions us
ORDER BY us.created_at DESC;

-- Show summary of plan distribution
SELECT 
  plan_name,
  status,
  COUNT(*) as subscription_count
FROM user_subscriptions 
GROUP BY plan_name, status
ORDER BY plan_name, status; 