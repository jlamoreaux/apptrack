-- Add trial_end and metadata fields to user_subscriptions for tracking free trials
ALTER TABLE public.user_subscriptions 
ADD COLUMN IF NOT EXISTS trial_end timestamp with time zone,
ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Add comment explaining the fields
COMMENT ON COLUMN public.user_subscriptions.trial_end IS 'End date for free trial periods granted via promo codes';
COMMENT ON COLUMN public.user_subscriptions.metadata IS 'Additional subscription metadata including promo codes and trial information';

-- Create an index on trial_end for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_trial_end 
ON public.user_subscriptions(trial_end) 
WHERE trial_end IS NOT NULL;