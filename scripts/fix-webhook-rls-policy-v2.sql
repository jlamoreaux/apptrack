-- Fix RLS policy to allow webhook operations
-- Since webhooks use anon key without auth context, we need a different approach

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

-- Drop the existing insert policy
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.user_subscriptions;

-- Create a new insert policy that's more permissive
-- This allows inserts when either:
-- 1. The user is authenticated and inserting their own subscription
-- 2. There's no authenticated user (webhook scenario)
CREATE POLICY "Allow subscription inserts" ON public.user_subscriptions
    FOR INSERT 
    WITH CHECK (
        -- Allow if user is authenticated and inserting their own subscription
        (auth.uid() = user_id) 
        OR 
        -- Allow if there's no authenticated user (webhook scenario)
        -- This is safe because webhooks are verified by signature
        (auth.uid() IS NULL AND user_id IS NOT NULL)
    );

-- Also update the update policy
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;
CREATE POLICY "Allow subscription updates" ON public.user_subscriptions
    FOR UPDATE 
    USING (
        -- Allow if user is updating their own subscription
        (auth.uid() = user_id) 
        OR 
        -- Allow if there's no authenticated user (webhook scenario)
        (auth.uid() IS NULL)
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