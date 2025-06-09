-- First, let's check if there are any issues with the trigger
-- and fix the profile creation function

-- Drop the existing trigger to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the handle_new_user function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    -- Create profile first
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    )
    ON CONFLICT (id) DO NOTHING;
    
    -- Get the free plan ID
    SELECT id INTO free_plan_id 
    FROM public.subscription_plans 
    WHERE name = 'Free' 
    LIMIT 1;
    
    -- Only proceed if we found a free plan
    IF free_plan_id IS NOT NULL THEN
        -- Create default subscription
        INSERT INTO public.user_subscriptions (user_id, plan_id, current_period_end)
        VALUES (
            NEW.id,
            free_plan_id,
            NOW() + INTERVAL '1 year'
        )
        ON CONFLICT (user_id) DO NOTHING;
        
        -- Create usage tracking
        INSERT INTO public.usage_tracking (user_id, applications_count)
        VALUES (NEW.id, 0)
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add unique constraints to prevent conflicts
ALTER TABLE public.user_subscriptions 
ADD CONSTRAINT unique_active_subscription_per_user 
UNIQUE (user_id, status) 
DEFERRABLE INITIALLY DEFERRED;

-- Remove the constraint if it causes issues
ALTER TABLE public.user_subscriptions 
DROP CONSTRAINT IF EXISTS unique_active_subscription_per_user;

-- Add a simpler unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_user_active 
ON public.user_subscriptions (user_id) 
WHERE status = 'active';

-- Fix the usage tracking to have a unique constraint
ALTER TABLE public.usage_tracking 
ADD CONSTRAINT unique_user_usage 
UNIQUE (user_id);
