-- Drip Emails & Audience Members Schema
-- For automated email sequences based on user lifecycle stage

-- Table to track audience membership (synced to Resend Audiences)
CREATE TABLE IF NOT EXISTS audience_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  current_audience TEXT NOT NULL,  -- leads, free-users, trial-users, paid-users
  resend_contact_id TEXT,  -- ID from Resend Audiences API
  subscribed BOOLEAN DEFAULT true,
  first_name TEXT,
  metadata JSONB DEFAULT '{}',  -- Additional data like source, roast_id, etc.
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT audience_members_audience_check CHECK (
    current_audience IN ('leads', 'free-users', 'trial-users', 'paid-users')
  )
);

-- Index for looking up by user_id
CREATE INDEX IF NOT EXISTS idx_audience_members_user_id ON audience_members(user_id);

-- Index for filtering by audience
CREATE INDEX IF NOT EXISTS idx_audience_members_audience ON audience_members(current_audience);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_audience_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audience_members_updated_at ON audience_members;
CREATE TRIGGER trigger_audience_members_updated_at
  BEFORE UPDATE ON audience_members
  FOR EACH ROW
  EXECUTE FUNCTION update_audience_members_updated_at();

-- Table to schedule and track drip emails
CREATE TABLE IF NOT EXISTS drip_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  audience TEXT NOT NULL,  -- which audience this drip belongs to
  template_id TEXT NOT NULL,  -- e.g., 'lead_day_0', 'free_day_1'
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT drip_emails_status_check CHECK (
    status IN ('pending', 'sent', 'failed', 'cancelled')
  ),
  CONSTRAINT drip_emails_audience_check CHECK (
    audience IN ('leads', 'free-users', 'trial-users', 'paid-users')
  ),
  -- Prevent sending the same template to the same email twice
  UNIQUE(email, template_id)
);

-- Index for the cron job to find pending emails efficiently
CREATE INDEX IF NOT EXISTS idx_drip_emails_pending
  ON drip_emails(scheduled_for, status)
  WHERE status = 'pending';

-- Index for looking up emails by user
CREATE INDEX IF NOT EXISTS idx_drip_emails_user_id ON drip_emails(user_id);

-- Index for looking up by email
CREATE INDEX IF NOT EXISTS idx_drip_emails_email ON drip_emails(email);

-- Enable RLS
ALTER TABLE audience_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audience_members
-- Users can view their own audience membership
CREATE POLICY "Users can view own audience membership"
  ON audience_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can do everything (for API routes)
CREATE POLICY "Service role full access to audience_members"
  ON audience_members
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for drip_emails
-- Users can view their own scheduled emails
CREATE POLICY "Users can view own drip emails"
  ON drip_emails
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can do everything (for API routes and cron)
CREATE POLICY "Service role full access to drip_emails"
  ON drip_emails
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
