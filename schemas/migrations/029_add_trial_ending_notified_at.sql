-- Migration: Add trial_ending_notified_at to user_subscriptions
-- Idempotency guard for the pre-charge trial-ending email so the notification
-- is sent at most once per subscription trial.

ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS trial_ending_notified_at timestamptz NULL;

COMMENT ON COLUMN public.user_subscriptions.trial_ending_notified_at IS 'Timestamp the pre-charge trial-ending email was sent. NULL until sent; used as an idempotency guard to avoid duplicate notifications.';
