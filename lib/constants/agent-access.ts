/**
 * CareerOtter agent access (MCP server + personal access tokens) constants.
 * The scope list is mirrored by the agent_tokens.scopes CHECK in
 * schemas/migrations/044_mcp_agent_access.sql; __tests__/constants/agent-access.test.ts
 * guards against drift.
 */

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

export const MCP_INSTRUCTIONS_VERSION = "1.0.0";

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
