-- Onboarding flows progress tracking
CREATE TABLE IF NOT EXISTS user_onboarding (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_id VARCHAR(50) NOT NULL,
  flow_version INTEGER NOT NULL DEFAULT 1,
  current_step_index INTEGER NOT NULL DEFAULT 0,
  completed_steps TEXT[] DEFAULT '{}',
  skipped_steps TEXT[] DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, flow_id)
);

-- Feature announcements tracking
CREATE TABLE IF NOT EXISTS user_announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  announcement_id VARCHAR(50) NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dismissed BOOLEAN DEFAULT FALSE,
  clicked_cta BOOLEAN DEFAULT FALSE,
  
  UNIQUE(user_id, announcement_id)
);

-- User onboarding preferences
CREATE TABLE IF NOT EXISTS user_onboarding_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enable_tooltips BOOLEAN DEFAULT TRUE,
  enable_announcements BOOLEAN DEFAULT TRUE,
  enable_guided_tours BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id ON user_onboarding(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_flow_id ON user_onboarding(flow_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_completed ON user_onboarding(user_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_user_announcements_user_id ON user_announcements(user_id);

-- Enable Row Level Security
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_onboarding_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own onboarding progress" ON user_onboarding
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own announcements" ON user_announcements
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own preferences" ON user_onboarding_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_onboarding_updated_at BEFORE UPDATE ON user_onboarding
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_onboarding_preferences_updated_at BEFORE UPDATE ON user_onboarding_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();