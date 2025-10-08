-- Verify customer's subscription status
-- Replace 'CUSTOMER_EMAIL' with the actual customer's email address

-- Check current subscription status
SELECT 
  p.email,
  sp.name as plan_name,
  us.status,
  us.billing_cycle,
  us.current_period_end,
  us.stripe_customer_id,
  us.stripe_subscription_id,
  CASE 
    WHEN us.status = 'active' AND us.current_period_end > NOW() THEN 'Yes'
    ELSE 'No'
  END as has_active_pro
FROM profiles p
JOIN user_subscriptions us ON p.id = us.user_id
JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE p.email = 'CUSTOMER_EMAIL'
ORDER BY us.created_at DESC
LIMIT 1;

-- Check if they can access Pro features (unlimited applications)
SELECT 
  p.email,
  COUNT(a.id) as current_application_count,
  CASE 
    WHEN sp.name = 'Pro' THEN 'Unlimited'
    WHEN sp.name = 'Free' THEN '5'
    ELSE 'Check plan'
  END as application_limit
FROM profiles p
LEFT JOIN applications a ON p.id = a.user_id
LEFT JOIN user_subscriptions us ON p.id = us.user_id AND us.status = 'active'
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE p.email = 'CUSTOMER_EMAIL'
GROUP BY p.email, sp.name;