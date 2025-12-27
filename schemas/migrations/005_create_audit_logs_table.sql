-- Create audit_logs table for tracking admin actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  
  -- Who performed the action
  user_id uuid NOT NULL,
  user_email text,
  user_name text,
  
  -- What action was performed
  action text NOT NULL, -- e.g., 'admin.user.added', 'promo.code.created'
  entity_type text, -- e.g., 'admin_user', 'promo_code'
  entity_id text, -- ID of the affected entity
  
  -- Details about the change
  old_values jsonb, -- Previous state (for updates/deletes)
  new_values jsonb, -- New state (for creates/updates)
  metadata jsonb, -- Additional context (IP, user agent, etc.)
  
  -- When it happened
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);
CREATE INDEX idx_audit_logs_entity_type_id ON public.audit_logs USING btree (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);

-- No RLS on audit_logs - only accessible server-side
-- This prevents tampering and ensures all actions are logged