-- Function to create default subscription and usage tracking for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    -- Get the free plan ID
    SELECT id INTO free_plan_id FROM public.subscription_plans WHERE name = 'Free' LIMIT 1;
    
    -- Create default subscription
    INSERT INTO public.user_subscriptions (user_id, plan_id, current_period_end)
    VALUES (
        NEW.id,
        free_plan_id,
        NOW() + INTERVAL '1 year' -- Free plan doesn't expire
    );
    
    -- Create usage tracking
    INSERT INTO public.usage_tracking (user_id, applications_count)
    VALUES (NEW.id, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the existing trigger to include subscription setup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    -- Create profile
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
    
    -- Get the free plan ID
    SELECT id INTO free_plan_id FROM public.subscription_plans WHERE name = 'Free' LIMIT 1;
    
    -- Create default subscription
    INSERT INTO public.user_subscriptions (user_id, plan_id, current_period_end)
    VALUES (
        NEW.id,
        free_plan_id,
        NOW() + INTERVAL '1 year' -- Free plan doesn't expire
    );
    
    -- Create usage tracking
    INSERT INTO public.usage_tracking (user_id, applications_count)
    VALUES (NEW.id, 0);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update usage count when applications are added/removed
CREATE OR REPLACE FUNCTION public.update_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment count
        INSERT INTO public.usage_tracking (user_id, applications_count, last_updated)
        VALUES (NEW.user_id, 1, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            applications_count = usage_tracking.applications_count + 1,
            last_updated = NOW();
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement count
        UPDATE public.usage_tracking 
        SET 
            applications_count = GREATEST(0, applications_count - 1),
            last_updated = NOW()
        WHERE user_id = OLD.user_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers for usage tracking
CREATE TRIGGER update_usage_on_insert
    AFTER INSERT ON public.applications
    FOR EACH ROW EXECUTE FUNCTION public.update_usage_count();

CREATE TRIGGER update_usage_on_delete
    AFTER DELETE ON public.applications
    FOR EACH ROW EXECUTE FUNCTION public.update_usage_count();

-- Add updated_at trigger for user_subscriptions
CREATE TRIGGER handle_updated_at_subscriptions
    BEFORE UPDATE ON public.user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
