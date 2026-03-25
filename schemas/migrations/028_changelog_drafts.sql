-- Changelog drafts table for weekly changelog automation
-- Stores AI-generated changelog drafts pending admin approval

CREATE TABLE IF NOT EXISTS changelog_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_of text NOT NULL,
  content jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  sent_at timestamptz,
  send_results jsonb
);

CREATE INDEX IF NOT EXISTS idx_changelog_drafts_status ON changelog_drafts(status);

-- RLS: only service role can access
ALTER TABLE changelog_drafts ENABLE ROW LEVEL SECURITY;
