-- AI Feature Rate Limiting Schema (Aggregated Statistics Only)
-- This schema manages rate limits and aggregated usage statistics

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

-- 2. Aggregated usage statistics (no individual user data)
CREATE TABLE IF NOT EXISTS public.ai_usage_stats (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  feature_name text NOT NULL,
  stat_date date NOT NULL,
  stat_hour integer, -- 0-23, NULL for daily stats
  total_requests integer DEFAULT 0,
  unique_users integer DEFAULT 0,
  successful_requests integer DEFAULT 0,
  failed_requests integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  
  -- Primary key
  CONSTRAINT ai_usage_stats_pkey PRIMARY KEY (id),
  
  -- Ensure unique stats per feature, date, and hour
  CONSTRAINT ai_usage_stats_unique UNIQUE (feature_name, stat_date, stat_hour)
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
CREATE INDEX IF NOT EXISTS idx_ai_usage_stats_lookup 
  ON public.ai_usage_stats USING btree (stat_date DESC, feature_name);

CREATE INDEX IF NOT EXISTS idx_ai_feature_limits_lookup 
  ON public.ai_feature_limits USING btree (feature_name, subscription_tier);

CREATE INDEX IF NOT EXISTS idx_ai_user_limit_overrides_lookup 
  ON public.ai_user_limit_overrides USING btree (user_id, feature_name)
  WHERE expires_at IS NULL OR expires_at > now();

-- Enable Row Level Security
ALTER TABLE public.ai_feature_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_user_limit_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_feature_limits (read-only for all authenticated users)
CREATE POLICY "Users can view feature limits" 
  ON public.ai_feature_limits FOR SELECT 
  USING (true);

-- RLS Policies for ai_usage_stats (read-only for all authenticated users)
CREATE POLICY "Users can view aggregated stats" 
  ON public.ai_usage_stats FOR SELECT 
  USING (true);

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