-- Update roasts table to use emoji scores instead of numeric scores
-- First add the new column
ALTER TABLE roasts ADD COLUMN IF NOT EXISTS emoji_score VARCHAR(20);

-- Migrate existing data (if any) - convert numeric scores to emojis
UPDATE roasts 
SET emoji_score = CASE 
    WHEN score < 2 THEN '💀/10'
    WHEN score < 3 THEN '🤢/10'
    WHEN score < 4 THEN '😬/10'
    WHEN score < 5 THEN '💩/10'
    WHEN score < 6 THEN '🥱/10'
    WHEN score < 7 THEN '🤡/10'
    WHEN score < 8 THEN '🔥/10'
    WHEN score < 9 THEN '🫠/10'
    ELSE '🙈/10'
END
WHERE emoji_score IS NULL AND score IS NOT NULL;

-- Drop the old numeric score column
ALTER TABLE roasts DROP COLUMN IF EXISTS score;

-- Update any views or functions that reference the score column
-- None exist yet in this case