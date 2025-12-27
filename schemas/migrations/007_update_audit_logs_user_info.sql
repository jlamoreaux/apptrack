-- Update existing audit logs with user information from profiles table
UPDATE public.audit_logs
SET 
  user_name = profiles.full_name,
  user_email = profiles.email
FROM public.profiles
WHERE 
  audit_logs.user_id = profiles.id
  AND (audit_logs.user_name IS NULL OR audit_logs.user_email IS NULL);

-- Specifically ensure Jordan's audit logs are updated
UPDATE public.audit_logs
SET 
  user_name = 'Jordan Lamoreaux',
  user_email = 'jnacious88@gmail.com'
WHERE 
  user_id = '07de3fb9-2062-4a83-b0c3-c7bf94dbcbab'
  AND (user_name IS NULL OR user_email IS NULL);