-- Remove foreign key constraint on audit_logs.user_id
-- This allows audit logs to persist after a user deletes their account
-- The user_email and user_name columns provide the necessary context

ALTER TABLE public.audit_logs
DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

-- Add a comment explaining why there's no FK
COMMENT ON COLUMN public.audit_logs.user_id IS 'User who performed the action. No FK constraint to allow audit logs to persist after user deletion.';
