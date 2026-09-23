/**
 * The OAuth discovery documents: authorization server metadata (RFC 8414)
 * and protected resource metadata (RFC 9728).
 *
 * The issuer and every endpoint URL are always on SITE_URL, whatever host
 * served the request. Only the protected resource's `resource` follows the
 * request origin, and only when that origin is accepted.
 */

import { AGENT_TOKEN_SCOPES } from "@/lib/constants/agent-access";
import {
  AGENT_OAUTH_GRANT_TYPES,
  AGENT_OAUTH_ISSUER,
  AGENT_OAUTH_METADATA_CACHE_CONTROL,
  AGENT_OAUTH_METADATA_CORS_HEADERS,
  AGENT_OAUTH_PATHS,
  AGENT_OAUTH_PKCE,
  AGENT_OAUTH_RESPONSE_TYPE,
  AGENT_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS,
  isMcpOAuthEnabled,
} from "@/lib/constants/agent-oauth";
import { oauthJson, oauthNotFound, oauthPreflight } from "@/lib/auth/oauth/http";
import { advertisedMcpResource } from "@/lib/auth/oauth/resource";

const HTTP_OK = 200;
const RESOURCE_NAME = "CareerOtter";
const BEARER_METHODS_SUPPORTED = ["header"];

const METADATA_HEADERS = {
  ...AGENT_OAUTH_METADATA_CORS_HEADERS,
  "Cache-Control": AGENT_OAUTH_METADATA_CACHE_CONTROL,
} as const;

// The protected resource's `resource` follows the request host, so a shared
// cache must key on it.
const PROTECTED_RESOURCE_HEADERS = {
  ...METADATA_HEADERS,
  Vary: "Host, X-Forwarded-Host",
} as const;

function onIssuer(path: string): string {
  return `${AGENT_OAUTH_ISSUER}${path}`;
}

/** RFC 8414 metadata; identical on every accepted host. */
export function authorizationServerMetadata(): Record<string, unknown> {
  return {
    issuer: AGENT_OAUTH_ISSUER,
    authorization_endpoint: onIssuer(AGENT_OAUTH_PATHS.authorize),
    token_endpoint: onIssuer(AGENT_OAUTH_PATHS.token),
    registration_endpoint: onIssuer(AGENT_OAUTH_PATHS.register),
    revocation_endpoint: onIssuer(AGENT_OAUTH_PATHS.revoke),
    response_types_supported: [AGENT_OAUTH_RESPONSE_TYPE],
    grant_types_supported: [...AGENT_OAUTH_GRANT_TYPES],
    code_challenge_methods_supported: [AGENT_OAUTH_PKCE.method],
    token_endpoint_auth_methods_supported: [...AGENT_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS],
    revocation_endpoint_auth_methods_supported: [...AGENT_OAUTH_TOKEN_ENDPOINT_AUTH_METHODS],
    scopes_supported: [...AGENT_TOKEN_SCOPES],
    // RFC 9207: every authorization response carries iss (mix-up defence).
    authorization_response_iss_parameter_supported: true,
  };
}

/** RFC 9728 metadata for the MCP resource as reached at `requestUrl`. */
export function protectedResourceMetadata(requestUrl: string): Record<string, unknown> {
  return {
    resource: advertisedMcpResource(requestUrl),
    authorization_servers: [AGENT_OAUTH_ISSUER],
    scopes_supported: [...AGENT_TOKEN_SCOPES],
    bearer_methods_supported: BEARER_METHODS_SUPPORTED,
    resource_name: RESOURCE_NAME,
  };
}

/** GET /.well-known/oauth-authorization-server */
export function authorizationServerMetadataResponse(): Response {
  if (!isMcpOAuthEnabled()) return oauthNotFound();
  return oauthJson(authorizationServerMetadata(), HTTP_OK, METADATA_HEADERS);
}

/** GET /.well-known/oauth-protected-resource, with or without the /api/mcp suffix. */
export function protectedResourceMetadataResponse(request: Request): Response {
  if (!isMcpOAuthEnabled()) return oauthNotFound();
  return oauthJson(protectedResourceMetadata(request.url), HTTP_OK, PROTECTED_RESOURCE_HEADERS);
}

/** OPTIONS on any of the metadata documents. */
export function metadataPreflightResponse(): Response {
  if (!isMcpOAuthEnabled()) return oauthNotFound();
  return oauthPreflight(METADATA_HEADERS);
}
