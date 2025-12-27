-- Add tagline column to store shareable one-liners
ALTER TABLE roasts 
ADD COLUMN IF NOT EXISTS tagline TEXT;