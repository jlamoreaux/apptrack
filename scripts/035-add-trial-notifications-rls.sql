-- Add RLS policies for trial_history and scheduled_notifications tables

-- Enable RLS on trial_history table
ALTER TABLE public.trial_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own trial history
CREATE POLICY "Users can view own trial history" 
ON public.trial_history
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy: System can insert trial history for authenticated users
CREATE POLICY "System can create trial history"
ON public.trial_history
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Enable RLS on scheduled_notifications table
ALTER TABLE public.scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own scheduled notifications
CREATE POLICY "Users can view own notifications"
ON public.scheduled_notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy: System can insert notifications for authenticated users
CREATE POLICY "System can create notifications"
ON public.scheduled_notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Policy: System can update notification status
CREATE POLICY "System can update notifications"
ON public.scheduled_notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Note on audit_logs table:
-- audit_logs should remain accessible only via admin client
-- as it contains sensitive administrative actions and should not
-- be accessible to regular users, even their own audit entries

-- Add comments explaining the security model
COMMENT ON TABLE public.trial_history IS 'Trial usage history with RLS. Users can only see and create their own trial records.';
COMMENT ON TABLE public.scheduled_notifications IS 'Scheduled email notifications with RLS. Users can only see their own notifications.';