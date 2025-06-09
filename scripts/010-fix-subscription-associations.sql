-- This script fixes any subscriptions that might be missing user associations

-- First, let's identify any subscriptions without proper user associations
SELECT 
  us.id, 
  us.stripe_subscription_id, 
  us.user_id,
  us.status
FROM 
  user_subscriptions us
WHERE 
  us.user_id IS NULL OR us.user_id = '';

-- For any subscriptions found above, you would need to manually associate them
-- with the correct user. This would require looking up the Stripe subscription
-- and finding the corresponding user.

-- This query helps identify active subscriptions for each user
SELECT 
  p.id as user_id,
  p.email,
  us.id as subscription_id,
  us.stripe_subscription_id,
  us.status,
  us.current_period_end
FROM 
  profiles p
LEFT JOIN 
  user_subscriptions us ON p.id = us.user_id
WHERE 
  us.status = 'active';

-- This query helps identify users who should have subscriptions but don't
SELECT 
  p.id as user_id,
  p.email,
  COUNT(us.id) as subscription_count
FROM 
  profiles p
LEFT JOIN 
  user_subscriptions us ON p.id = us.user_id AND us.status = 'active'
GROUP BY 
  p.id, p.email
HAVING 
  COUNT(us.id) = 0;
