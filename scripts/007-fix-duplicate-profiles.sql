-- First, let's see if there are duplicate profiles
SELECT id, email, count(*) as duplicate_count
FROM public.profiles 
GROUP BY id, email 
HAVING count(*) > 1;

-- Check for profiles without corresponding auth users
SELECT p.id, p.email, u.id as auth_user_id
FROM public.profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL;

-- Clean up any duplicate profiles (keep the most recent one)
WITH ranked_profiles AS (
  SELECT id, email, created_at,
         ROW_NUMBER() OVER (PARTITION BY id ORDER BY created_at DESC) as rn
  FROM public.profiles
)
DELETE FROM public.profiles 
WHERE (id, created_at) IN (
  SELECT id, created_at 
  FROM ranked_profiles 
  WHERE rn > 1
);

-- Ensure we have a unique constraint on profiles.id
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_pkey;

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

-- Fix the trigger function to handle conflicts better
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    -- Create profile with conflict handling
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        updated_at = NOW();
    
    -- Get the free plan ID
    SELECT id INTO free_plan_id 
    FROM public.subscription_plans 
    WHERE name = 'Free' 
    LIMIT 1;
    
    -- Only proceed if we found a free plan
    IF free_plan_id IS NOT NULL THEN
        -- Create default subscription with conflict handling
        INSERT INTO public.user_subscriptions (user_id, plan_id, current_period_end)
        VALUES (
            NEW.id,
            free_plan_id,
            NOW() + INTERVAL '1 year'
        )
        ON CONFLICT (user_id) WHERE status = 'active' DO NOTHING;
        
        -- Create usage tracking with conflict handling
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

-- Make sure the trigger is properly set up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
