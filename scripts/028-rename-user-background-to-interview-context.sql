-- Rename user_background column to interview_context in interview_prep table
ALTER TABLE interview_prep 
RENAME COLUMN user_background TO interview_context;

-- Update any existing indexes if they reference the old column name
-- (The existing indexes should work fine since they reference the column by position) 