/**
 * CareerOtter agent access (MCP server + personal access tokens) constants.
 * The scope list is mirrored by the agent_tokens.scopes CHECK in
 * schemas/migrations/044_mcp_agent_access.sql; __tests__/constants/agent-access.test.ts
 * guards against drift.
 */

import { MS_PER_SECOND } from "@/lib/constants/dates";

export const AGENT_TOKEN_SCOPES = [
  "wins:read",
  "wins:write",
  "career:read",
  "comp:read",
  "comp:write",
] as const;
export type AgentTokenScope = (typeof AGENT_TOKEN_SCOPES)[number];

// Write implies read: write results and duplicate external_ref hits return the
// stored row, so a write-only token could not be made leak-free anyway.
export const SCOPE_IMPLIES: Partial<
  Record<AgentTokenScope, readonly AgentTokenScope[]>
> = {
  "wins:write": ["wins:read"],
  "comp:write": ["comp:read"],
};

export const AGENT_TOKEN_PREFIX = "co_pat_";

// Expiry is chosen from these; "never" (null) is a separate option that is
// refused when a comp scope is requested.
export const AGENT_TOKEN_EXPIRY_DAYS_OPTIONS = [30, 90, 365] as const;
export type AgentTokenExpiryDays =
  (typeof AGENT_TOKEN_EXPIRY_DAYS_OPTIONS)[number];
export const DEFAULT_AGENT_TOKEN_EXPIRY_DAYS: AgentTokenExpiryDays = 90;

export const AGENT_TOKEN_LIMITS = {
  maxActivePerUser: 10,
  nameMax: 60,
  // AGENT_TOKEN_PREFIX plus 7 characters: enough to tell tokens apart in the
  // list without exposing a useful part of the secret.
  displayPrefixLength: 14,
} as const;

/** Arguments for createRateLimiter (lib/redis/client.ts) plus the key prefix. */
export interface AgentRateLimit {
  tokens: number;
  window: string;
  keyPrefix: string;
}

export const AGENT_RATE_LIMITS = {
  tokenCreate: { tokens: 10, window: "1 m", keyPrefix: "pat-create:" },
  perToken: { tokens: 300, window: "1 m", keyPrefix: "mcp:" },
  authFailPerIp: { tokens: 30, window: "1 m", keyPrefix: "mcp-auth-fail:" },
} as const satisfies Record<string, AgentRateLimit>;

// Bounds the blast radius of a prompt-injected agent. Counted over agent-source
// rows only, so manual entries never consume the quota.
export const AGENT_WRITE_QUOTAS = {
  winsPer24h: 50,
  compEntriesPer24h: 25,
  compEntriesTotal: 500,
} as const;

// last_used_at is advisory, so it is written at most this often per token
// rather than on every request.
export const LAST_USED_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export const MCP_MAX_BODY_BYTES = 64 * 1024;

export const MCP_LIST_WINS = {
  defaultLimit: 50,
  maxLimit: 200,
} as const;

export const MCP_INSTRUCTIONS_VERSION = "1.1.0";

// Random bytes behind each token; 256 bits makes guessing infeasible.
export const AGENT_TOKEN_SECRET_BYTES = 32;

// CRC32 of the token body in base36. The largest CRC32 (0xffffffff) is
// "1z141z3" in base36, so 7 characters always fit once left-padded.
export const AGENT_TOKEN_CHECKSUM_LENGTH = 7;

// Comp data is the most sensitive the agent API exposes, so tokens carrying
// these scopes must have an expiry.
export const AGENT_COMP_SCOPES: readonly AgentTokenScope[] = [
  "comp:read",
  "comp:write",
];

// Unique index on (user_id, name) where revoked_at is null. Token creation
// maps its violation to a 409, so the name is load-bearing (migration 044).
export const AGENT_TOKEN_ACTIVE_NAME_CONSTRAINT = "agent_tokens_user_active_name_key";

// Name of the SQL function in migration 044 that creates a token under the
// active-token limit, and the message it raises when the limit is reached.
export const CREATE_AGENT_TOKEN_RPC = "create_agent_token";
export const AGENT_TOKEN_LIMIT_ERROR = "agent_token_limit";

export const MCP_SERVER_INFO = { name: "careerotter", version: "1.0.0" } as const;

// mcp-handler serves `${basePath}/mcp`, so this places the endpoint at the
// app/api/mcp route.
export const MCP_BASE_PATH = "/api";
export const MCP_ENDPOINT_PATH = "/mcp";
/** The MCP endpoint's path, and the path of the OAuth protected resource. */
export const MCP_RESOURCE_PATH = `${MCP_BASE_PATH}${MCP_ENDPOINT_PATH}`;

// Mirrors `maxDuration` in app/api/mcp/route.ts, which Next.js requires to be
// a literal there.
export const MCP_MAX_DURATION_SECONDS = 30;

export const MCP_UNAVAILABLE_RETRY_AFTER_SECONDS = 5;

// Shown for unexpected tool failures; the real error is only logged.
export const MCP_TOOL_FAILED_MESSAGE = "Tool failed; try again";

// Tells the agent how to retry safely: a write may have committed even though
// the result never arrived.
export const MCP_TOOL_TIMEOUT_MESSAGE =
  "The tool timed out. If it was a write, retry with the same external_ref to avoid duplicates.";

// Room left under maxDuration to log and send the 504 before the platform
// kills the function.
const MCP_DEADLINE_HEADROOM_SECONDS = 5;

// Deadlines on the MCP request path. A slow dependency must end in a clear
// error while the function can still respond.
export const MCP_DEADLINES_MS = {
  tokenVerify: 5_000,
  rateLimit: 2_000,
  tool: 20_000,
  request: (MCP_MAX_DURATION_SECONDS - MCP_DEADLINE_HEADROOM_SECONDS) * MS_PER_SECOND,
} as const;
