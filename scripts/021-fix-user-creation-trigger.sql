-- Fix user creation trigger
-- Run this if the trigger is broken or missing

-- 1. Drop existing trigger and function to start fresh
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. Create a robust trigger function with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    free_plan_id UUID;
    profile_created BOOLEAN := FALSE;
    subscription_created BOOLEAN := FALSE;
    usage_created BOOLEAN := FALSE;
BEGIN
    -- Log the trigger execution
    RAISE LOG 'handle_new_user triggered for user: %', NEW.id;
    
    -- Create profile first
    BEGIN
        INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            NOW(),
            NOW()
        );
        profile_created := TRUE;
        RAISE LOG 'Profile created for user: %', NEW.id;
    EXCEPTION
        WHEN unique_violation THEN
            -- Profile already exists, update it
            UPDATE public.profiles 
            SET 
                email = NEW.email,
                full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', profiles.full_name),
                updated_at = NOW()
            WHERE id = NEW.id;
            profile_created := TRUE;
            RAISE LOG 'Profile updated for user: %', NEW.id;
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to create/update profile for user %: %', NEW.id, SQLERRM;
    END;
    
    -- Get the free plan ID
    BEGIN
        SELECT id INTO free_plan_id 
        FROM public.subscription_plans 
        WHERE name = 'Free' 
        LIMIT 1;
        
        IF free_plan_id IS NULL THEN
            RAISE WARNING 'Free plan not found in subscription_plans table';
            RETURN NEW;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to get free plan ID: %', SQLERRM;
            RETURN NEW;
    END;
    
    -- Create default subscription
    IF free_plan_id IS NOT NULL THEN
        BEGIN
            INSERT INTO public.user_subscriptions (user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
            VALUES (
                NEW.id,
                free_plan_id,
                'active',
                'monthly',
                NOW(),
                NOW() + INTERVAL '1 year',
                NOW(),
                NOW()
            );
            subscription_created := TRUE;
            RAISE LOG 'Subscription created for user: %', NEW.id;
        EXCEPTION
            WHEN unique_violation THEN
                -- Subscription already exists, do nothing
                RAISE LOG 'Subscription already exists for user: %', NEW.id;
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to create subscription for user %: %', NEW.id, SQLERRM;
        END;
        
        -- Create usage tracking
        BEGIN
            INSERT INTO public.usage_tracking (user_id, applications_count, last_updated)
            VALUES (NEW.id, 0, NOW());
            usage_created := TRUE;
            RAISE LOG 'Usage tracking created for user: %', NEW.id;
        EXCEPTION
            WHEN unique_violation THEN
                -- Usage tracking already exists, do nothing
                RAISE LOG 'Usage tracking already exists for user: %', NEW.id;
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to create usage tracking for user %: %', NEW.id, SQLERRM;
        END;
    END IF;
    
    -- Log final status
    RAISE LOG 'User setup completed for %: profile=%, subscription=%, usage=%', 
        NEW.id, profile_created, subscription_created, usage_created;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Verify the trigger was created
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- 5. Create missing profiles for existing users (if any)
INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
SELECT 
    u.id,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', u.email),
    u.created_at,
    NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 6. Create missing subscriptions for existing users (if any)
INSERT INTO public.user_subscriptions (user_id, plan_id, status, billing_cycle, current_period_start, current_period_end, created_at, updated_at)
SELECT 
    u.id,
    (SELECT id FROM subscription_plans WHERE name = 'Free' LIMIT 1),
    'active',
    'monthly',
    NOW(),
    NOW() + INTERVAL '1 year',
    NOW(),
    NOW()
FROM auth.users u
LEFT JOIN public.user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
WHERE us.user_id IS NULL
ON CONFLICT (user_id) WHERE status = 'active' DO NOTHING;

-- 7. Create missing usage tracking for existing users (if any)
INSERT INTO public.usage_tracking (user_id, applications_count, last_updated)
SELECT 
    u.id,
    0,
    NOW()
FROM auth.users u
LEFT JOIN public.usage_tracking ut ON u.id = ut.user_id
WHERE ut.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING; 