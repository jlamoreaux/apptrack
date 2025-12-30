-- Migration 018: Fix Display Order Race Condition
-- Create a database function to atomically get the next display_order for a user

-- Function to get next display_order atomically
CREATE OR REPLACE FUNCTION public.get_next_display_order(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_order INTEGER;
BEGIN
  -- Lock the user's resumes to prevent concurrent inserts getting the same order
  -- This ensures atomicity when calculating the next display_order
  SELECT COALESCE(MAX(display_order), 0) + 1 INTO next_order
  FROM public.user_resumes
  WHERE user_id = p_user_id
  FOR UPDATE;

  RETURN next_order;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_next_display_order(UUID) TO authenticated;

-- Comment
COMMENT ON FUNCTION public.get_next_display_order IS 'Atomically calculates the next display_order value for a user''s resumes, preventing race conditions during concurrent uploads';
