/**
 * Display copy and setup snippets for the Connected agents UI
 * (components/careerotter/connected-agents.tsx). Client-safe: no server imports.
 */

import {
  AGENT_TOKEN_EXPIRY_DAYS_OPTIONS,
  MCP_BASE_PATH,
  MCP_SERVER_INFO,
  type AgentTokenExpiryDays,
  type AgentTokenScope,
} from "@/lib/constants/agent-access";
import { APP_ROUTES } from "@/lib/constants/routes";
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

export const AGENT_TOKEN_STATUSES = [
  "active",
  "expired",
  "revoked",
] as const satisfies readonly AgentTokenStatus[];

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

export const AGENT_TOKEN_FORM_MESSAGES = {
  nameRequired: "Enter a name for this token.",
  scopesRequired: "Choose at least one thing this agent can do.",
} as const;

const DATA_PAGE_PATH = "/dashboard/data";

/** Where a 401 from the token API sends the user, returning them here after sign-in. */
export const AGENT_ACCESS_SIGN_IN_HREF = `${APP_ROUTES.LOGIN}?redirectTo=${DATA_PAGE_PATH}`;

export const AGENT_TOKEN_ENV_VAR = "CAREEROTTER_TOKEN";
// mcp-remote reads the whole header value from here; see the Claude Desktop snippet.
const AGENT_AUTH_HEADER_ENV_VAR = "CAREEROTTER_AUTH_HEADER";
const MCP_SERVER_NAME = MCP_SERVER_INFO.name;
// mcp-handler serves the endpoint at `${MCP_BASE_PATH}/mcp`.
export const MCP_ENDPOINT_PATH = "/mcp";
const TOKEN_PASTE_PLACEHOLDER = "<paste token>";
const TOKEN_PLACEHOLDER = "<token>";
const JSON_INDENT = 2;

const SECURE_PROTOCOL = "https:";
const LOOPBACK_PROTOCOL = "http:";
// URL.hostname keeps the brackets around an IPv6 address.
const LOOPBACK_HOSTNAMES: readonly string[] = ["localhost", "127.0.0.1", "[::1]"];

/** Shown in place of the setup snippets when isSafeMcpBaseUrl is false. */
export const AGENT_SETUP_INSECURE_NOTICE =
  "Setup instructions are unavailable because this site isn't served over HTTPS.";

/**
 * True when agents may be told to send a bearer token to this base URL:
 * HTTPS, or plain HTTP to a loopback host for local development. Anything
 * else (plain HTTP to a real host, other schemes, unparseable values) would
 * put the token on the wire in clear text.
 */
export function isSafeMcpBaseUrl(appUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(appUrl);
  } catch {
    return false;
  }
  if (url.protocol === SECURE_PROTOCOL) return true;
  return url.protocol === LOOPBACK_PROTOCOL && LOOPBACK_HOSTNAMES.includes(url.hostname);
}

export interface AgentSetupSnippetSet {
  endpoint: string;
  envHint: string;
  claudeCode: string;
  claudeCodeProjectConfig: string;
  claudeDesktopConfig: string;
  otherClients: string;
}

function toJson(value: unknown): string {
  return JSON.stringify(value, null, JSON_INDENT);
}

/**
 * Where possible, snippets reference the token through an environment variable
 * rather than the raw value, so the secret stays out of shell history and
 * committed config files. Claude Desktop does not inherit the shell's
 * environment, so its config carries the token in its own `env` block.
 */
export function buildAgentSetupSnippets(appUrl: string): AgentSetupSnippetSet {
  const endpoint = `${appUrl}${MCP_BASE_PATH}${MCP_ENDPOINT_PATH}`;
  const shellHeader = `"Authorization: Bearer $${AGENT_TOKEN_ENV_VAR}"`;

  const claudeCodeProjectConfig = toJson({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        type: "http",
        url: endpoint,
        headers: { Authorization: `Bearer \${${AGENT_TOKEN_ENV_VAR}}` },
      },
    },
  });

  // No space after "Authorization:" because some clients (Claude Desktop on
  // Windows) split unescaped spaces inside args; mcp-remote expands ${VAR}
  // in header values from `env`, where spaces are safe.
  const claudeDesktopConfig = toJson({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: "npx",
        args: [
          "mcp-remote",
          endpoint,
          "--header",
          `Authorization:\${${AGENT_AUTH_HEADER_ENV_VAR}}`,
        ],
        env: { [AGENT_AUTH_HEADER_ENV_VAR]: `Bearer ${TOKEN_PASTE_PLACEHOLDER}` },
      },
    },
  });

  return {
    endpoint,
    envHint: `export ${AGENT_TOKEN_ENV_VAR}=${TOKEN_PASTE_PLACEHOLDER}`,
    claudeCode: `claude mcp add --transport http ${MCP_SERVER_NAME} ${endpoint} --header ${shellHeader}`,
    claudeCodeProjectConfig,
    claudeDesktopConfig,
    otherClients: `URL: ${endpoint}\nHeader: Authorization: Bearer ${TOKEN_PLACEHOLDER}`,
  };
}
