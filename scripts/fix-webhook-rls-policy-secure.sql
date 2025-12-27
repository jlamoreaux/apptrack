-- More secure RLS policy fix
-- This reverts the permissive policy and suggests using service role instead

-- First, let's revert to the original, more secure policies
DROP POLICY IF EXISTS "Allow subscription inserts" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Allow subscription updates" ON public.user_subscriptions;

-- Restore the original secure policies
CREATE POLICY "Users can insert own subscription" ON public.user_subscriptions
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON public.user_subscriptions
    FOR UPDATE 
    USING (auth.uid() = user_id);

-- Verify the policies are restored
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

-- The proper solution is to use service role key in webhooks
-- Add this to your .env:
-- SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here