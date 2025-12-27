-- Check and insert AI feature limits if they don't exist
-- This ensures the rate limiting system has the necessary configuration

-- First, check if limits exist
DO $$
BEGIN
  -- Check if we have any limits configured
  IF NOT EXISTS (SELECT 1 FROM public.ai_feature_limits LIMIT 1) THEN
    RAISE NOTICE 'No AI feature limits found. Inserting default limits...';
    
    -- Insert default limits for each subscription tier
    INSERT INTO public.ai_feature_limits (feature_name, subscription_tier, daily_limit, hourly_limit)
    VALUES 
      -- Free tier (NO AI access)
      ('resume_analysis', 'free', 0, 0),
      ('interview_prep', 'free', 0, 0),
      ('cover_letter', 'free', 0, 0),
      ('career_advice', 'free', 0, 0),
      ('job_fit_analysis', 'free', 0, 0),
      
      -- Pro tier (moderate limits)
      ('resume_analysis', 'pro', 10, 3),
      ('interview_prep', 'pro', 20, 5),
      ('cover_letter', 'pro', 15, 3),
      ('career_advice', 'pro', 50, 10),
      ('job_fit_analysis', 'pro', 30, 5),
      
      -- AI Coach tier (VERY generous limits)
      ('resume_analysis', 'ai_coach', 50, 10),
      ('interview_prep', 'ai_coach', 100, 20),
      ('cover_letter', 'ai_coach', 75, 15),
      ('career_advice', 'ai_coach', 500, 50),
      ('job_fit_analysis', 'ai_coach', 150, 30);
    
    RAISE NOTICE 'AI feature limits have been configured successfully.';
  ELSE
    RAISE NOTICE 'AI feature limits already exist. Updating to ensure correct values...';
    
    -- Update existing limits or insert if missing
    INSERT INTO public.ai_feature_limits (feature_name, subscription_tier, daily_limit, hourly_limit)
    VALUES 
      -- Free tier (NO AI access)
      ('resume_analysis', 'free', 0, 0),
      ('interview_prep', 'free', 0, 0),
      ('cover_letter', 'free', 0, 0),
      ('career_advice', 'free', 0, 0),
      ('job_fit_analysis', 'free', 0, 0),
      
      -- Pro tier (moderate limits)
      ('resume_analysis', 'pro', 10, 3),
      ('interview_prep', 'pro', 20, 5),
      ('cover_letter', 'pro', 15, 3),
      ('career_advice', 'pro', 50, 10),
      ('job_fit_analysis', 'pro', 30, 5),
      
      -- AI Coach tier (VERY generous limits)
      ('resume_analysis', 'ai_coach', 50, 10),
      ('interview_prep', 'ai_coach', 100, 20),
      ('cover_letter', 'ai_coach', 75, 15),
      ('career_advice', 'ai_coach', 500, 50),
      ('job_fit_analysis', 'ai_coach', 150, 30)
    ON CONFLICT (feature_name, subscription_tier) 
    DO UPDATE SET 
      daily_limit = EXCLUDED.daily_limit,
      hourly_limit = EXCLUDED.hourly_limit,
      updated_at = now();
  END IF;
END $$;

-- Verify the limits are set correctly
SELECT 
  feature_name,
  subscription_tier,
  daily_limit,
  hourly_limit
FROM public.ai_feature_limits
ORDER BY subscription_tier, feature_name;