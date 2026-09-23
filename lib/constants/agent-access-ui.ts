/**
 * Display copy and setup snippets for the Connected agents UI
 * (components/careerotter/connected-agents.tsx). Client-safe: no server imports.
 */

import {
  AGENT_TOKEN_EXPIRY_DAYS_OPTIONS,
  MCP_BASE_PATH,
  type AgentTokenExpiryDays,
  type AgentTokenScope,
} from "@/lib/constants/agent-access";
import type { AgentTokenStatus } from "@/types";

export interface AgentScopeDetail {
  label: string;
  description: string;
}

export const AGENT_SCOPE_DETAILS = {
  "wins:read": {
    label: "Wins: read",
    description: "List your wins and see coverage.",
  },
  "wins:write": {
    label: "Wins: write",
    description: "Log wins, and edit or delete the ones agents logged.",
  },
  "career:read": {
    label: "Career profile: read",
    description: "See your goal, target role, and review date.",
  },
  "comp:read": {
    label: "Comp: read",
    description: "See your comp history, projections, and offer comparisons.",
  },
  "comp:write": {
    label: "Comp: write",
    description: "Add comp entries, and edit or delete the ones agents added.",
  },
} as const satisfies Record<AgentTokenScope, AgentScopeDetail>;

export const DEFAULT_AGENT_TOKEN_SCOPES: readonly AgentTokenScope[] = [
  "wins:read",
  "wins:write",
];

export const AGENT_TOKEN_STATUS_LABELS = {
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
} as const satisfies Record<AgentTokenStatus, string>;

/** Select value for a token that never expires (the API's `null`). */
export const NEVER_EXPIRES = "never";
export type AgentTokenExpiryChoice = AgentTokenExpiryDays | typeof NEVER_EXPIRES;

export const AGENT_TOKEN_EXPIRY_CHOICES: readonly {
  value: AgentTokenExpiryChoice;
  label: string;
}[] = [
  ...AGENT_TOKEN_EXPIRY_DAYS_OPTIONS.map((days) => ({
    value: days,
    label: `${days} days`,
  })),
  { value: NEVER_EXPIRES, label: "Never" },
];

/** Shown for a null last-used or expiry date. */
export const AGENT_TOKEN_NEVER_LABEL = "Never";

export const AGENT_TOKEN_ENV_VAR = "CAREEROTTER_TOKEN";
export const MCP_SERVER_NAME = "careerotter";
const JSON_INDENT = 2;

export interface AgentSetupSnippets {
  endpoint: string;
  envHint: string;
  claudeCode: string;
  jsonConfig: string;
  claudeDesktop: string;
}

/**
 * Snippets reference the token through an environment variable, never the raw
 * value, so the secret stays out of shell history and committed config files.
 */
export function buildAgentSetupSnippets(siteUrl: string): AgentSetupSnippets {
  const endpoint = `${siteUrl}${MCP_BASE_PATH}/mcp`;
  const shellHeader = `"Authorization: Bearer $${AGENT_TOKEN_ENV_VAR}"`;
  const templatedHeader = `Bearer \${${AGENT_TOKEN_ENV_VAR}}`;
  const jsonConfig = JSON.stringify(
    {
      mcpServers: {
        [MCP_SERVER_NAME]: {
          type: "http",
          url: endpoint,
          headers: { Authorization: templatedHeader },
        },
      },
    },
    null,
    JSON_INDENT
  );

  return {
    endpoint,
    envHint: `export ${AGENT_TOKEN_ENV_VAR}=<paste token>`,
    claudeCode: `claude mcp add --transport http ${MCP_SERVER_NAME} ${endpoint} --header ${shellHeader}`,
    jsonConfig,
    claudeDesktop: `npx mcp-remote ${endpoint} --header "Authorization: ${templatedHeader}"`,
  };
}
