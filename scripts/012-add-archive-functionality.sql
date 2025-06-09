-- Add archived field to applications table
ALTER TABLE applications 
ADD COLUMN archived BOOLEAN DEFAULT FALSE;

-- Add index for better performance when filtering archived applications
CREATE INDEX idx_applications_archived ON applications(user_id, archived);

-- Update the view to exclude archived applications by default
CREATE OR REPLACE VIEW active_applications AS
SELECT * FROM applications 
WHERE archived = FALSE;
