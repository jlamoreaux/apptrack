-- Pre-Registration AI Features Schema
-- This schema supports:
-- 1. Pre-registration AI sessions (job fit, cover letter, interview prep)
-- 2. Free tier AI usage tracking per user
-- 3. Rate limiting for anonymous users

-- ============================================================================
-- Table 1: ai_preview_sessions
-- Stores pre-registration AI sessions with encrypted full content
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_preview_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session identification
  session_fingerprint TEXT NOT NULL,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('resume_analysis', 'job_fit', 'cover_letter', 'interview_prep')),

  -- Input data (stored for regeneration if needed)
  input_data JSONB NOT NULL,

  -- Results (preview shown immediately, full content encrypted until signup)
  preview_content JSONB NOT NULL,
  full_content_encrypted TEXT NOT NULL,

  -- Conversion tracking
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,

  -- Shareable results (optional feature)
  shareable_id TEXT UNIQUE,
  share_count INTEGER DEFAULT 0
);

-- Indexes for ai_preview_sessions
CREATE INDEX IF NOT EXISTS idx_ai_preview_fingerprint
  ON ai_preview_sessions(session_fingerprint, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_preview_user
  ON ai_preview_sessions(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_preview_shareable
  ON ai_preview_sessions(shareable_id)
  WHERE shareable_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_preview_feature_type
  ON ai_preview_sessions(feature_type, created_at);

-- ============================================================================
-- Table 2: ai_feature_usage
-- Tracks AI feature usage for registered users (free tier limits)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User and feature
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('resume_analysis', 'job_fit', 'cover_letter', 'interview_prep', 'career_chat')),

  -- Track subscription tier at time of use (for historical data)
  subscription_tier TEXT NOT NULL DEFAULT 'free',

  -- Usage tracking
  used_at TIMESTAMPTZ DEFAULT NOW(),
  credits_used INTEGER DEFAULT 1,

  -- Link to generated content (optional - for accessing previous generations)
  content_id UUID,

  -- Metadata
  ip_address INET,
  user_agent TEXT
);

-- Indexes for ai_feature_usage
CREATE INDEX IF NOT EXISTS idx_ai_feature_usage_user
  ON ai_feature_usage(user_id, feature_type, used_at);

CREATE INDEX IF NOT EXISTS idx_ai_feature_usage_tier
  ON ai_feature_usage(subscription_tier, used_at);

CREATE INDEX IF NOT EXISTS idx_ai_feature_usage_date
  ON ai_feature_usage(used_at);

-- ============================================================================
-- Table 3: ai_preview_usage
-- Rate limiting table for anonymous/pre-registration users
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_preview_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rate limiting identifiers
  fingerprint TEXT NOT NULL,
  ip_address INET NOT NULL,
  feature_type TEXT NOT NULL,

  -- Timestamp
  used_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for rate limiting queries
CREATE INDEX IF NOT EXISTS idx_ai_preview_usage_rate_limit
  ON ai_preview_usage(fingerprint, feature_type, used_at);

CREATE INDEX IF NOT EXISTS idx_ai_preview_usage_ip
  ON ai_preview_usage(ip_address, feature_type, used_at);

-- ============================================================================
-- Function: check_ai_feature_allowance
-- Checks if a user can use a specific AI feature based on their tier
-- ============================================================================

CREATE OR REPLACE FUNCTION check_ai_feature_allowance(
  p_user_id UUID,
  p_feature_type TEXT,
  p_subscription_tier TEXT DEFAULT 'free'
)
RETURNS BOOLEAN AS $$
DECLARE
  usage_count INTEGER;
  max_free_uses INTEGER := 1; -- Each feature gets 1 free try
BEGIN
  -- AI Coach tier gets unlimited access
  IF p_subscription_tier = 'ai_coach' THEN
    RETURN TRUE;
  END IF;

  -- Career chat is AI Coach only (no free tier)
  IF p_feature_type = 'career_chat' THEN
    RETURN FALSE;
  END IF;

  -- Check free tier usage count
  SELECT COUNT(*)
  INTO usage_count
  FROM ai_feature_usage
  WHERE user_id = p_user_id
    AND feature_type = p_feature_type
    AND subscription_tier = 'free';

  -- Return TRUE if user has free tries remaining
  RETURN usage_count < max_free_uses;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: cleanup_old_ai_preview_sessions
-- Removes unconverted sessions older than 30 days and old rate limit entries
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_ai_preview_sessions()
RETURNS void AS $$
BEGIN
  -- Delete unconverted preview sessions older than 30 days
  DELETE FROM ai_preview_sessions
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND user_id IS NULL;  -- Only delete unconverted sessions

  -- Delete rate limit entries older than 7 days
  DELETE FROM ai_preview_usage
  WHERE used_at < NOW() - INTERVAL '7 days';

  -- Log cleanup (optional - for monitoring)
  RAISE NOTICE 'Cleaned up old AI preview sessions and rate limit entries';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Cron Job: Schedule cleanup to run daily at 2 AM
-- Requires pg_cron extension (usually enabled in Supabase)
-- ============================================================================

-- Check if pg_cron is available, if so schedule the job
DO $$
BEGIN
  -- Only schedule if pg_cron extension exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    PERFORM cron.unschedule('cleanup-ai-preview-sessions');

    -- Schedule new job to run daily at 2 AM
    PERFORM cron.schedule(
      'cleanup-ai-preview-sessions',
      '0 2 * * *', -- Run at 2 AM daily
      $$SELECT cleanup_old_ai_preview_sessions()$$
    );

    RAISE NOTICE 'Scheduled cleanup job for AI preview sessions';
  ELSE
    RAISE NOTICE 'pg_cron extension not available, skipping job scheduling';
  END IF;
END
$$;

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE ai_preview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_preview_usage ENABLE ROW LEVEL SECURITY;

-- ai_preview_sessions policies
-- Users can only see their own converted sessions
CREATE POLICY "Users can view own sessions"
  ON ai_preview_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for API routes)
CREATE POLICY "Service role has full access to preview sessions"
  ON ai_preview_sessions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ai_feature_usage policies
-- Users can view their own usage
CREATE POLICY "Users can view own usage"
  ON ai_feature_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role has full access to feature usage"
  ON ai_feature_usage
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ai_preview_usage policies
-- Service role only (no user access)
CREATE POLICY "Service role has full access to preview usage"
  ON ai_preview_usage
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Grant permissions
-- ============================================================================

-- Grant execute permissions on functions to authenticated users and service role
GRANT EXECUTE ON FUNCTION check_ai_feature_allowance(UUID, TEXT, TEXT)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION cleanup_old_ai_preview_sessions()
  TO service_role;

-- ============================================================================
-- Validation and Comments
-- ============================================================================

COMMENT ON TABLE ai_preview_sessions IS
  'Stores pre-registration AI feature sessions with encrypted full content until user signs up';

COMMENT ON TABLE ai_feature_usage IS
  'Tracks AI feature usage for registered users to enforce free tier limits (1 try per feature)';

COMMENT ON TABLE ai_preview_usage IS
  'Rate limiting table for anonymous users trying pre-registration AI features';

COMMENT ON FUNCTION check_ai_feature_allowance IS
  'Checks if a user can use an AI feature based on their subscription tier and usage history';

COMMENT ON FUNCTION cleanup_old_ai_preview_sessions IS
  'Removes unconverted sessions older than 30 days and rate limit entries older than 7 days';

-- ============================================================================
-- Migration Complete
-- ============================================================================

SELECT 'Pre-registration AI features schema migration completed successfully!' as status;
