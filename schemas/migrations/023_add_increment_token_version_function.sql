-- Migration: Add atomic increment function for extension token version
-- Fixes race condition in revokeExtensionTokens by using database-level atomic increment

-- Create function for atomic token version increment
CREATE OR REPLACE FUNCTION increment_extension_token_version(user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_version integer;
BEGIN
  UPDATE profiles
  SET extension_token_version = extension_token_version + 1
  WHERE id = user_id
  RETURNING extension_token_version INTO new_version;

  RETURN COALESCE(new_version, 1);
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION increment_extension_token_version(uuid) IS 'Atomically increment extension_token_version for a user, used for token revocation. Returns the new version number.';
