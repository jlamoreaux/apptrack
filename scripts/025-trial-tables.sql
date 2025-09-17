-- Table to track trial history (prevent reuse)
CREATE TABLE IF NOT EXISTS public.trial_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  promo_code text NOT NULL,
  trial_start timestamp with time zone NOT NULL,
  trial_end timestamp with time zone NOT NULL,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE(user_id) -- One trial per user
);

-- Table for scheduled notifications
CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email text NOT NULL,
  type text NOT NULL,
  scheduled_for timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamp with time zone,
  error text,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT scheduled_notifications_status_check CHECK (
    status IN ('pending', 'sent', 'failed', 'cancelled')
  )
);

-- Index for finding pending notifications
CREATE INDEX idx_scheduled_notifications_pending 
ON public.scheduled_notifications(scheduled_for, status) 
WHERE status = 'pending';

-- Index for user's notifications
CREATE INDEX idx_scheduled_notifications_user 
ON public.scheduled_notifications(user_id);