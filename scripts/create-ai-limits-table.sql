-- Create the AI feature limits table and populate it with data
-- Run this in your Supabase SQL Editor

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.ai_feature_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  feature_name text NOT NULL,
  subscription_tier text NOT NULL,
  daily_limit integer NOT NULL,
  hourly_limit integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Primary key
  CONSTRAINT ai_feature_limits_pkey PRIMARY KEY (id),
  
  -- Ensure unique limits per feature and tier
  CONSTRAINT ai_feature_limits_unique UNIQUE (feature_name, subscription_tier)
);

-- 2. Enable Row Level Security
ALTER TABLE public.ai_feature_limits ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policy (read-only for all authenticated users)
CREATE POLICY "Users can view feature limits" 
  ON public.ai_feature_limits FOR SELECT 
  USING (true);

-- 4. Insert the rate limits
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

-- 5. Grant necessary permissions
GRANT SELECT ON public.ai_feature_limits TO authenticated;
GRANT ALL ON public.ai_feature_limits TO service_role;

-- 6. Verify the table was created and populated
SELECT 
  feature_name,
  subscription_tier,
  daily_limit,
  hourly_limit
FROM public.ai_feature_limits
ORDER BY subscription_tier, feature_name;