-- Career Companion Phase 0: waitlist + campaign send markers
-- PRD: .claude/ship/PRD.md
--
-- career_waitlist is the ground truth for the Phase 0 gate (join counts and
-- review_timing distribution). Append-only: the API route inserts with
-- ON CONFLICT (email) DO NOTHING so anonymous traffic can never mutate rows.
-- Service-role only: all access goes through API routes (CLAUDE.md rule 4).
--
-- The review_timing and source CHECK lists are mirrored by
-- lib/constants/career.ts — keep both in sync (guarded by a Jest test).

CREATE TABLE IF NOT EXISTS career_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  review_timing TEXT NOT NULL,
  source TEXT NOT NULL,
  utm JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT career_waitlist_review_timing_check CHECK (
    review_timing IN ('lt_3_months', '3_6_months', '6_12_months', 'no_formal_reviews', 'not_sure')
  ),
  CONSTRAINT career_waitlist_source_check CHECK (
    source IN ('email', 'banner', 'direct')
  )
);

-- Phase 2 cohort selection filters on review_timing
CREATE INDEX IF NOT EXISTS idx_career_waitlist_review_timing
  ON career_waitlist(review_timing);

-- One row per campaign; the primary key doubles as a concurrency guard so a
-- second trigger of the same broadcast fails atomically instead of re-sending.
CREATE TABLE IF NOT EXISTS campaign_sends (
  campaign TEXT PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_count INT NOT NULL DEFAULT 0,
  metadata JSONB
);

-- Enable RLS
ALTER TABLE career_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;

-- RLS Policies: service-role only (no client access on either table)
DROP POLICY IF EXISTS "Service role full access to career_waitlist" ON career_waitlist;
CREATE POLICY "Service role full access to career_waitlist"
  ON career_waitlist
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access to campaign_sends" ON campaign_sends;
CREATE POLICY "Service role full access to campaign_sends"
  ON campaign_sends
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
