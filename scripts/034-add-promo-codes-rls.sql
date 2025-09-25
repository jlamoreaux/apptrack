-- Enable RLS on promo_codes table
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow authenticated users to read active promo codes
CREATE POLICY "Users can read active promo codes" 
ON public.promo_codes
FOR SELECT
TO authenticated
USING (active = true);

-- Policy 2: Allow authenticated users to check promo code usage
-- This allows the check endpoint to verify if a user has already used a code
CREATE POLICY "Users can check their promo code usage"
ON public.promo_code_usage
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Policy 3: Allow system to insert promo code usage records
-- This allows the activate-trial endpoint to record usage
CREATE POLICY "System can create promo code usage"
ON public.promo_code_usage
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Policy 4: Allow system to increment usage count
-- This requires a more complex approach - we'll use a function
CREATE OR REPLACE FUNCTION increment_promo_code_usage(promo_code_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE promo_codes 
  SET used_count = used_count + 1
  WHERE id = promo_code_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_promo_code_usage(UUID) TO authenticated;

-- Enable RLS on promo_code_usage table if not already enabled
ALTER TABLE public.promo_code_usage ENABLE ROW LEVEL SECURITY;

-- Add comment explaining the security model
COMMENT ON TABLE public.promo_codes IS 'Promo codes table with RLS. Users can only read active codes. Usage tracking is handled via secure functions.';