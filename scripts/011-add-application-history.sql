-- Add Hired status and create application history tracking
ALTER TABLE applications 
DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE applications 
ADD CONSTRAINT applications_status_check 
CHECK (status IN ('Applied', 'Interview Scheduled', 'Interviewed', 'Offer', 'Hired', 'Rejected'));

-- Create application history table to track status changes
CREATE TABLE IF NOT EXISTS application_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_application_history_application_id ON application_history(application_id);
CREATE INDEX IF NOT EXISTS idx_application_history_changed_at ON application_history(changed_at);

-- Insert initial history records for existing applications
INSERT INTO application_history (application_id, old_status, new_status, changed_at, notes)
SELECT id, NULL, status, created_at, 'Initial status'
FROM applications
WHERE id NOT IN (SELECT DISTINCT application_id FROM application_history);
