-- Fix RLS policy to allow webhook operations
-- This adds a policy that allows inserts when the request comes from service role

-- First, let's check current policies
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_subscriptions';

-- Add a new policy that allows service role to insert/update subscriptions
-- This policy will allow operations when auth.jwt() ->> 'role' = 'service_role'
CREATE POLICY "Service role can insert subscriptions" ON public.user_subscriptions
    FOR INSERT 
    WITH CHECK (
        -- Allow if user is authenticated and inserting their own subscription
        (auth.uid() = user_id) 
        OR 
        -- Allow if the operation is from service role (webhooks)
        (auth.jwt() ->> 'role' = 'service_role')
    );

-- Update the existing update policy to also allow service role
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;
CREATE POLICY "Users can update own subscription" ON public.user_subscriptions
    FOR UPDATE 
    USING (
        (auth.uid() = user_id) 
        OR 
        (auth.jwt() ->> 'role' = 'service_role')
    );

-- Verify the new policies
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_subscriptions'
ORDER BY policyname;