-- Fix check_ai_feature_allowance function to use correct column names
-- The ai_feature_usage table has feature_name (not feature_type)
-- and does not have a subscription_tier column

-- Add INSERT/UPDATE policy so authenticated users can track their own usage
-- (currently only SELECT policies exist for regular users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_feature_usage'
    AND policyname = 'Users can track own usage'
  ) THEN
    CREATE POLICY "Users can track own usage"
      ON ai_feature_usage
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_feature_usage'
    AND policyname = 'Users can update own usage'
  ) THEN
    CREATE POLICY "Users can update own usage"
      ON ai_feature_usage
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION check_ai_feature_allowance(
  p_user_id uuid,
  p_feature_type text,
  p_subscription_tier text DEFAULT 'free'::text
) RETURNS boolean AS $$
DECLARE
  usage_count INTEGER;
  max_free_uses INTEGER := 1; -- Each feature gets 1 free try
BEGIN
  -- AI Coach tier gets unlimited access
  IF p_subscription_tier = 'ai_coach' THEN
    RETURN TRUE;
  END IF;

  -- Career advice is AI Coach only (no free tier)
  IF p_feature_type = 'career_advice' OR p_feature_type = 'career_chat' THEN
    RETURN FALSE;
  END IF;

  -- Check free tier usage count using correct column name
  SELECT COALESCE(SUM(ai_feature_usage.usage_count), 0)
  INTO usage_count
  FROM ai_feature_usage
  WHERE user_id = p_user_id
    AND feature_name = p_feature_type;

  -- Return TRUE if user has free tries remaining
  RETURN usage_count < max_free_uses;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track AI feature usage with proper upsert/increment
CREATE OR REPLACE FUNCTION track_ai_feature_usage(
  p_user_id uuid,
  p_feature_name text
) RETURNS void AS $$
BEGIN
  INSERT INTO ai_feature_usage (user_id, feature_name, usage_date, usage_count)
  VALUES (p_user_id, p_feature_name, CURRENT_DATE, 1)
  ON CONFLICT (user_id, feature_name, usage_date)
  DO UPDATE SET
    usage_count = ai_feature_usage.usage_count + 1,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
