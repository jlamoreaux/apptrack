/**
 * The `WWW-Authenticate` challenge the MCP route sends with a 401 while OAuth
 * is enabled (RFC 6750 §3, RFC 9728 §5.1):
 *
 *   Bearer resource_metadata="<origin>/.well-known/oauth-protected-resource/api/mcp",
 *          scope="wins:read wins:write"[, error="invalid_token", error_description="…"]
 *
 * `resource_metadata` starts the client's discovery; `scope` makes SDK-based
 * clients request the PAT defaults rather than every supported scope. The
 * error pair is added only when a bearer token was presented (RFC 6750 §3.1).
 * The origin comes from the accepted-origins allowlist, so a spoofed Host
 * header can't point a client at someone else's metadata.
 */

import {
  AGENT_OAUTH_DEFAULT_SCOPE_HINT,
  AGENT_OAUTH_PATHS,
  AGENT_OAUTH_TOKEN_TYPE,
  MCP_BEARER_FAILURE_DESCRIPTIONS,
  MCP_INVALID_TOKEN_ERROR,
} from "@/lib/constants/agent-oauth";
import { advertisedMcpOrigin } from "@/lib/auth/oauth/resource";
import type { McpBearerTokenFailure } from "@/types";

const AUTH_PARAM_SEPARATOR = ", ";
// quoted-string (RFC 9110 §5.6.4): a backslash escapes `"` and `\` itself.
const QUOTED_PAIR_CHARACTERS = /["\\]/g;

/** `value` as an HTTP quoted-string, for an auth-param. */
export function quotedString(value: string): string {
  return `"${value.replace(QUOTED_PAIR_CHARACTERS, "\\$&")}"`;
}

/** The protected resource metadata URL advertised for a request. */
function mcpResourceMetadataUrl(requestUrl: string): string {
  return `${advertisedMcpOrigin(requestUrl)}${AGENT_OAUTH_PATHS.protectedResourceMetadata}`;
}

/**
 * The challenge for a request to `requestUrl`: discovery only when `failure`
 * is null (no bearer token was presented), plus `invalid_token` otherwise.
 */
export function mcpBearerChallenge(
  requestUrl: string,
  failure: McpBearerTokenFailure | null
): string {
  const params: [name: string, value: string][] = [
    ["resource_metadata", mcpResourceMetadataUrl(requestUrl)],
    ["scope", AGENT_OAUTH_DEFAULT_SCOPE_HINT],
  ];
  if (failure !== null) {
    params.push(
      ["error", MCP_INVALID_TOKEN_ERROR],
      ["error_description", MCP_BEARER_FAILURE_DESCRIPTIONS[failure]]
    );
  }
  const rendered = params.map(([name, value]) => `${name}=${quotedString(value)}`);
  return `${AGENT_OAUTH_TOKEN_TYPE} ${rendered.join(AUTH_PARAM_SEPARATOR)}`;
}
