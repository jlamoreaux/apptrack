import {
  authorizationServerMetadataResponse,
  metadataPreflightResponse,
} from "@/lib/auth/oauth/metadata";

/**
 * /.well-known/oauth-authorization-server: OAuth 2.0 authorization server
 * metadata (RFC 8414) for the MCP server. 404 unless isMcpOAuthEnabled().
 */

// Read the OAuth flag at request time, never at build time.
export const dynamic = "force-dynamic";

export function GET(): Response {
  return authorizationServerMetadataResponse();
}

export function OPTIONS(): Response {
  return metadataPreflightResponse();
}
