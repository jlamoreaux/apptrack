-- Create admin_users table for managing admin access
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NULL,
  notes text NULL,
  CONSTRAINT admin_users_pkey PRIMARY KEY (id),
  CONSTRAINT admin_users_user_id_key UNIQUE (user_id),
  CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users USING btree (user_id);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Only admins can view the admin list
CREATE POLICY "Admins can view admin users" ON public.admin_users
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  ));

-- Only admins can insert new admins
CREATE POLICY "Admins can add new admins" ON public.admin_users
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  ));

-- Only admins can delete admins (but not themselves)
CREATE POLICY "Admins can remove other admins" ON public.admin_users
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
    AND user_id != auth.uid()
  );

-- Insert the initial admin user
INSERT INTO public.admin_users (user_id, notes)
VALUES ('07de3fb9-2062-4a83-b0c3-c7bf94dbcbab', 'Initial admin user')
ON CONFLICT (user_id) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE public.admin_users IS 'Table containing user IDs that have admin privileges';
COMMENT ON COLUMN public.admin_users.user_id IS 'Reference to the user in auth.users table';
COMMENT ON COLUMN public.admin_users.notes IS 'Optional notes about why this user is an admin';