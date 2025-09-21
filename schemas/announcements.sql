-- Announcements table for storing platform announcements
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'info', -- info, warning, success, error
  active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0, -- Higher priority shows first
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  target_audience VARCHAR(50) DEFAULT 'all', -- all, new_users, premium, etc.
  cta_text VARCHAR(100),
  cta_link VARCHAR(500),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_announcement_id ON announcements(announcement_id);

-- Enable Row Level Security
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read active announcements
CREATE POLICY "Anyone can view active announcements" ON announcements
  FOR SELECT USING (
    active = TRUE 
    AND start_date <= NOW() 
    AND (end_date IS NULL OR end_date > NOW())
  );

-- Only admins can manage announcements
CREATE POLICY "Admins can manage announcements" ON announcements
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM admin_users WHERE is_active = TRUE
    )
  );

-- Updated at trigger
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();