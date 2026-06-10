-- Retention Strategy: per-category email preferences + drip engagement tracking
-- RFC/PRD: docs/design-proposals/retention-strategy-prd.md
--
-- audience_members.subscribed remains the master suppression switch (CAN-SPAM).
-- This table adds the per-category split (drip / reminders / digest) that the
-- lifecycle emails need. Absence of a row means "all categories enabled".

CREATE TABLE IF NOT EXISTS email_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  drip_enabled BOOLEAN NOT NULL DEFAULT true,
  reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  digest_enabled BOOLEAN NOT NULL DEFAULT true,
  unsubscribed_all BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own preferences
DROP POLICY IF EXISTS "Users can view own email preferences" ON email_preferences;
CREATE POLICY "Users can view own email preferences"
  ON email_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own preferences
DROP POLICY IF EXISTS "Users can update own email preferences" ON email_preferences;
CREATE POLICY "Users can update own email preferences"
  ON email_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role (API routes + cron) can do everything
DROP POLICY IF EXISTS "Service role full access to email_preferences" ON email_preferences;
CREATE POLICY "Service role full access to email_preferences"
  ON email_preferences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Engagement tracking columns for lifecycle emails (open/click), reused across
-- the existing drip engine instead of a parallel email_events table.
ALTER TABLE drip_emails ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE drip_emails ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
