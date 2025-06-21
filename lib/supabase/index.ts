// Export all Supabase types
export * from "./types";

// Export client configurations
export { supabase as clientSupabase } from "./client";
export { supabase as browserSupabase } from "./browser-client";
export { supabase } from "./browser-client"; // Default export for backward compatibility
export { createClient, createMiddlewareClient } from "./server-client";
