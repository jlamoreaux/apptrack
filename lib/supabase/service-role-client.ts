import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js"

/**
 * Creates a Supabase client with service role key that bypasses RLS
 * ONLY use this for server-side operations like webhooks where RLS bypass is required
 * Never expose this to client-side code
 */
export function createServiceRoleClient(): SupabaseClient {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "Webhooks cannot create subscriptions without it. " +
      "See: /scripts/add-service-role-key.md"
    );
  }

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export type ServiceRoleClient = ReturnType<typeof createServiceRoleClient>;