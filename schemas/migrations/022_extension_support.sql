-- Migration: Extension Support
-- Adds extension_token_version column to profiles for token revocation
-- Adds index for efficient duplicate checking

-- Add token version column for extension token revocation
-- Default is 1, increment to invalidate all existing extension tokens
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS extension_token_version integer DEFAULT 1 NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN profiles.extension_token_version IS 'Version number for extension token revocation. Increment to invalidate all existing extension tokens for this user.';

-- Index for efficient duplicate checking in applications table
-- Used by GET /api/applications/check-duplicate endpoint
CREATE INDEX IF NOT EXISTS idx_applications_duplicate_check
ON applications (user_id, archived)
WHERE archived = false;

-- Add comment explaining the index
COMMENT ON INDEX idx_applications_duplicate_check IS 'Index for efficient duplicate application checking by user_id when archived is false.';
