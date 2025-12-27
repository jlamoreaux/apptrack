-- Rollback migration 029-add-trial-fields.sql
-- Remove the trial_end and metadata columns that we don't actually need

-- Drop the index first
DROP INDEX IF EXISTS idx_user_subscriptions_trial_end;

-- Remove the columns
ALTER TABLE public.user_subscriptions 
DROP COLUMN IF EXISTS trial_end,
DROP COLUMN IF EXISTS metadata;

-- Note: This is safe to run even if the columns don't exist due to IF EXISTS clause