-- Fix emoji_score column size to accommodate emoji characters
-- Emojis can be up to 4 bytes per character, so we need more space
ALTER TABLE roasts 
ALTER COLUMN emoji_score TYPE VARCHAR(50);