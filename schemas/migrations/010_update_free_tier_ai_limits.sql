-- Migration: Update free tier AI limits to allow 1 daily try per feature
-- This allows free users to try each AI feature once per day

UPDATE public.ai_feature_limits
SET
  daily_limit = 1,
  hourly_limit = 1,
  updated_at = now()
WHERE subscription_tier = 'free';
