-- AI Feature Rate Limiting Schema
-- This schema manages rate limits and usage tracking for AI features

-- 1. Feature limits configuration table
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

-- 2. Usage tracking table for audit and analytics
CREATE TABLE IF NOT EXISTS public.ai_usage_tracking (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature_name text NOT NULL,
  used_at timestamp with time zone DEFAULT now(),
  success boolean DEFAULT true,
  error_message text,
  metadata jsonb,
  response_time_ms integer,
  
  -- Primary key
  CONSTRAINT ai_usage_tracking_pkey PRIMARY KEY (id),
  
  -- Foreign key
  CONSTRAINT ai_usage_tracking_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES auth.users (id) ON DELETE CASCADE
);

-- 3. User-specific limit overrides (for admin adjustments)
CREATE TABLE IF NOT EXISTS public.ai_user_limit_overrides (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feature_name text NOT NULL,
  daily_limit integer,
  hourly_limit integer,
  expires_at timestamp with time zone,
  reason text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  
  -- Primary key
  CONSTRAINT ai_user_limit_overrides_pkey PRIMARY KEY (id),
  
  -- Foreign keys
  CONSTRAINT ai_user_limit_overrides_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT ai_user_limit_overrides_created_by_fkey FOREIGN KEY (created_by) 
    REFERENCES auth.users (id) ON DELETE SET NULL,
    
  -- Unique override per user and feature
  CONSTRAINT ai_user_limit_overrides_unique UNIQUE (user_id, feature_name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_user_feature 
  ON public.ai_usage_tracking USING btree (user_id, feature_name, used_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_used_at 
  ON public.ai_usage_tracking USING btree (used_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_feature_limits_lookup 
  ON public.ai_feature_limits USING btree (feature_name, subscription_tier);

CREATE INDEX IF NOT EXISTS idx_ai_user_limit_overrides_lookup 
  ON public.ai_user_limit_overrides USING btree (user_id, feature_name)
  WHERE expires_at IS NULL OR expires_at > now();

-- Enable Row Level Security
ALTER TABLE public.ai_feature_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_user_limit_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_feature_limits (read-only for all authenticated users)
CREATE POLICY "Users can view feature limits" 
  ON public.ai_feature_limits FOR SELECT 
  USING (true);

-- RLS Policies for ai_usage_tracking (users can only see their own usage)
CREATE POLICY "Users can view their own usage" 
  ON public.ai_usage_tracking FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert usage tracking" 
  ON public.ai_usage_tracking FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for ai_user_limit_overrides (users can see their own overrides)
CREATE POLICY "Users can view their own limit overrides" 
  ON public.ai_user_limit_overrides FOR SELECT 
  USING (auth.uid() = user_id);

-- Insert default limits for each subscription tier
INSERT INTO public.ai_feature_limits (feature_name, subscription_tier, daily_limit, hourly_limit)
VALUES 
  -- Free tier (NO AI access)
  ('resume_analysis', 'free', 0, 0),
  ('interview_prep', 'free', 0, 0),
  ('cover_letter', 'free', 0, 0),
  ('career_advice', 'free', 0, 0),
  ('job_fit_analysis', 'free', 0, 0),
  
  -- Pro tier (moderate limits - old AI Coach limits)
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

-- Create a view for easy usage statistics
CREATE OR REPLACE VIEW public.ai_usage_stats AS
SELECT 
  user_id,
  feature_name,
  DATE(used_at) as usage_date,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE success = true) as successful_requests,
  COUNT(*) FILTER (WHERE success = false) as failed_requests,
  AVG(response_time_ms) FILTER (WHERE response_time_ms IS NOT NULL) as avg_response_time_ms
FROM public.ai_usage_tracking
GROUP BY user_id, feature_name, DATE(used_at);

-- Grant necessary permissions
GRANT SELECT ON public.ai_usage_stats TO authenticated;

-- Function to get user's current usage
CREATE OR REPLACE FUNCTION get_ai_usage_count(
  p_user_id uuid,
  p_feature_name text,
  p_window_hours integer DEFAULT 24
) RETURNS integer AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.ai_usage_tracking
    WHERE user_id = p_user_id
      AND feature_name = p_feature_name
      AND used_at > (now() - interval '1 hour' * p_window_hours)
      AND success = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's limits (considering overrides)
CREATE OR REPLACE FUNCTION get_user_ai_limits(
  p_user_id uuid,
  p_feature_name text,
  p_subscription_tier text
) RETURNS TABLE(daily_limit integer, hourly_limit integer) AS $$
BEGIN
  -- First check for user-specific overrides
  RETURN QUERY
  SELECT uo.daily_limit, uo.hourly_limit
  FROM public.ai_user_limit_overrides uo
  WHERE uo.user_id = p_user_id
    AND uo.feature_name = p_feature_name
    AND (uo.expires_at IS NULL OR uo.expires_at > now())
  LIMIT 1;
  
  -- If no override found, return default limits for tier
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT fl.daily_limit, fl.hourly_limit
    FROM public.ai_feature_limits fl
    WHERE fl.feature_name = p_feature_name
      AND fl.subscription_tier = p_subscription_tier
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;