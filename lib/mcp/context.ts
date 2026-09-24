import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentCredentialKind, AgentTokenScope } from "@/types";

/**
 * What every MCP tool runs with: the service-role client and the identity of
 * the verified credential. Built once per request after authentication.
 */
export interface McpToolContext {
  readonly admin: SupabaseClient;
  readonly userId: string;
  /** How the request authenticated: a personal access token or an OAuth access token. */
  readonly credentialKind: AgentCredentialKind;
  /**
   * The credential's id: an agent_tokens id for a PAT, an agent_oauth_grants
   * id for OAuth. Read it together with credentialKind; the two id spaces
   * must never be mixed (a grant id passed to touchLastUsed would touch
   * nothing, or the wrong row).
   */
  readonly tokenId: string;
  readonly scopes: readonly AgentTokenScope[];
  readonly now: Date;
}
