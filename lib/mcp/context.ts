import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentTokenScope } from "@/types";

/**
 * What every MCP tool runs with: the service-role client and the identity of
 * the verified token. Built once per request after authentication.
 */
export interface McpToolContext {
  readonly admin: SupabaseClient;
  readonly userId: string;
  readonly tokenId: string;
  readonly scopes: readonly AgentTokenScope[];
  readonly now: Date;
}
