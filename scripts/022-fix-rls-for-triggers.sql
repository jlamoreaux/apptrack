-- Fix RLS policies for trigger functions
-- This ensures that trigger functions can bypass RLS when needed

-- 1. Drop existing RLS policies that might interfere with triggers
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2. Create new policies that allow trigger functions to work
-- Allow users to insert their own profile (for manual profile creation)
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Allow trigger functions to bypass RLS (SECURITY DEFINER functions)
CREATE POLICY "Trigger functions can manage profiles" ON public.profiles
    FOR ALL USING (true)
    WITH CHECK (true);

-- 3. Also fix subscription and usage tracking RLS if needed
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;

CREATE POLICY "Users can insert own subscription" ON public.user_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON public.user_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Trigger functions can manage subscriptions" ON public.user_subscriptions
    FOR ALL USING (true)
    WITH CHECK (true);

-- 4. Fix usage tracking RLS
DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can update own usage" ON public.usage_tracking;

CREATE POLICY "Users can insert own usage" ON public.usage_tracking
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own usage" ON public.usage_tracking
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Trigger functions can manage usage" ON public.usage_tracking
    FOR ALL USING (true)
    WITH CHECK (true);

-- 5. Verify the policies are in place
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('profiles', 'user_subscriptions', 'usage_tracking')
ORDER BY tablename, policyname; 