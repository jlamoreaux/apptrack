-- Create roasts table for Resume Roast feature
CREATE TABLE IF NOT EXISTS roasts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shareable_id VARCHAR(12) UNIQUE NOT NULL, -- Short ID for shareable URLs
    content TEXT NOT NULL, -- The roast text (PII filtered)
    score DECIMAL(3,1) CHECK (score >= 0 AND score <= 10), -- Score out of 10
    score_label VARCHAR(50), -- e.g., "Room for Improvement"
    first_name VARCHAR(50), -- First name only for personalization
    roast_categories JSONB, -- Categories of issues found
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'), -- Auto-expire after 30 days
    ip_hash VARCHAR(64), -- Hashed IP for rate limiting (privacy-safe)
    browser_fingerprint VARCHAR(64), -- Hashed browser fingerprint for rate limiting
    view_count INTEGER DEFAULT 0,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Optional, if user is logged in
    metadata JSONB DEFAULT '{}' -- Additional metadata (share sources, etc.)
);

-- Indexes for performance
CREATE INDEX idx_roasts_shareable_id ON roasts(shareable_id);
CREATE INDEX idx_roasts_created_at ON roasts(created_at DESC);
CREATE INDEX idx_roasts_expires_at ON roasts(expires_at);
CREATE INDEX idx_roasts_ip_hash ON roasts(ip_hash);
CREATE INDEX idx_roasts_browser_fingerprint ON roasts(browser_fingerprint);
CREATE INDEX idx_roasts_user_id ON roasts(user_id);

-- Function to auto-delete expired roasts
CREATE OR REPLACE FUNCTION delete_expired_roasts()
RETURNS void AS $$
BEGIN
    DELETE FROM roasts WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE roasts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read roasts by shareable_id (for sharing)
CREATE POLICY "Public roasts are viewable by shareable_id" ON roasts
    FOR SELECT
    USING (true);

-- Policy: Authenticated users can create roasts
CREATE POLICY "Authenticated users can create roasts" ON roasts
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Users can view their own roasts
CREATE POLICY "Users can view their own roasts" ON roasts
    FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_roast_views(p_shareable_id VARCHAR)
RETURNS void AS $$
BEGIN
    UPDATE roasts 
    SET view_count = view_count + 1
    WHERE shareable_id = p_shareable_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique shareable ID
CREATE OR REPLACE FUNCTION generate_shareable_id()
RETURNS VARCHAR AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
    result VARCHAR := '';
    i INTEGER;
BEGIN
    -- Generate 8 character random string
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate shareable_id before insert
CREATE OR REPLACE FUNCTION set_shareable_id()
RETURNS TRIGGER AS $$
DECLARE
    new_id VARCHAR;
    id_exists BOOLEAN;
BEGIN
    -- Keep generating until we get a unique ID
    LOOP
        new_id := generate_shareable_id();
        SELECT EXISTS(SELECT 1 FROM roasts WHERE shareable_id = new_id) INTO id_exists;
        EXIT WHEN NOT id_exists;
    END LOOP;
    
    NEW.shareable_id := new_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_shareable_id
    BEFORE INSERT ON roasts
    FOR EACH ROW
    WHEN (NEW.shareable_id IS NULL)
    EXECUTE FUNCTION set_shareable_id();