/**
 * The MCP resource URL (RFC 8707 / RFC 9728): normalizing a presented
 * `resource`, checking it against the accepted set, and choosing the one to
 * advertise for a request.
 *
 * The accepted set is `<origin>/api/mcp` for SITE_URL and each
 * CAREEROTTER_MCP_EXTRA_ORIGINS entry, so a spoofed Host header can never
 * change what is accepted or advertised.
 */

import {
  AGENT_OAUTH_LIMITS,
  getAcceptedMcpOrigins,
  getAcceptedMcpResources,
  mcpResourceUrl,
} from "@/lib/constants/agent-oauth";
import { hasCredentials, hasFragment, parseUrl } from "@/lib/auth/oauth/url";
import { SITE_URL } from "@/lib/constants/site-config";

const TRAILING_SLASH = /\/$/;

/**
 * `raw` with the scheme and host lowercased, a default port dropped and one
 * trailing slash dropped from the path; null when it isn't an absolute URI,
 * is too long, or carries a fragment or credentials (RFC 8707 §2).
 */
export function normalizeResource(raw: string): string | null {
  if (raw.length > AGENT_OAUTH_LIMITS.resourceMaxLength) return null;
  const url = parseUrl(raw);
  if (url === null || hasFragment(raw) || hasCredentials(url)) return null;
  // URL already lowercases the scheme and host and drops a default port.
  const path = url.pathname.replace(TRAILING_SLASH, "");
  return `${url.protocol}//${url.host}${path}${url.search}`;
}

/** The normalized resource when it's one of ours, else null. */
export function toAcceptedMcpResource(raw: string): string | null {
  const normalized = normalizeResource(raw);
  if (normalized === null) return null;
  return getAcceptedMcpResources().includes(normalized) ? normalized : null;
}

/**
 * The origin to advertise the MCP resource on for a request: its own origin
 * when that origin is accepted, otherwise SITE_URL.
 */
export function advertisedMcpOrigin(requestUrl: string): string {
  const origin = parseUrl(requestUrl)?.origin;
  if (origin !== undefined && getAcceptedMcpOrigins().includes(origin)) return origin;
  return SITE_URL;
}

/**
 * The MCP resource to advertise for a request: its own origin's when that
 * origin is accepted, otherwise SITE_URL's.
 */
export function advertisedMcpResource(requestUrl: string): string {
  return mcpResourceUrl(advertisedMcpOrigin(requestUrl));
}
