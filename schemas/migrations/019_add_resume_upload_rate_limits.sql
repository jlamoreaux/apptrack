-- Migration 019: Add Rate Limits for Resume Upload Feature
-- Prevents abuse of resume upload endpoint with file size limits

-- Add resume_upload rate limits for all subscription tiers
INSERT INTO public.ai_feature_limits (feature_name, subscription_tier, daily_limit, hourly_limit)
VALUES
  -- Free tier: Very limited uploads (1 resume anyway)
  ('resume_upload', 'free', 3, 2),

  -- Pro tier: Moderate upload limits
  ('resume_upload', 'pro', 20, 5),

  -- AI Coach tier: Generous upload limits (100 resume slots)
  ('resume_upload', 'ai_coach', 50, 15)
ON CONFLICT (feature_name, subscription_tier)
DO UPDATE SET
  daily_limit = EXCLUDED.daily_limit,
  hourly_limit = EXCLUDED.hourly_limit,
  updated_at = now();

-- Comment
COMMENT ON TABLE public.ai_feature_limits IS 'Rate limits for AI features and resume uploads, preventing abuse while allowing legitimate usage';
