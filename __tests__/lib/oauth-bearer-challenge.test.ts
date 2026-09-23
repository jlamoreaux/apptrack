/**
 * @jest-environment node
 */
/**
 * The MCP route's OAuth challenge (lib/auth/oauth/bearer-challenge.ts):
 * - discovery only (resource_metadata and the scope hint) without a failure
 * - invalid_token with a description per failure
 * - every parameter is a well-formed quoted-string, and the descriptions stay
 *   within RFC 6750's error_description charset
 * - quotedString escapes `"` and `\`
 */

import { mcpBearerChallenge, quotedString } from "@/lib/auth/oauth/bearer-challenge";
import {
  AGENT_OAUTH_DEFAULT_SCOPE_HINT,
  MCP_BEARER_FAILURE_DESCRIPTIONS,
} from "@/lib/constants/agent-oauth";
import { SITE_URL } from "@/lib/constants/site-config";
import type { McpBearerTokenFailure } from "@/types";

const REQUEST_URL = `${SITE_URL}/api/mcp`;
const METADATA_URL = `${SITE_URL}/.well-known/oauth-protected-resource/api/mcp`;

// RFC 6750 §3: Bearer 1#auth-param, each value a quoted-string.
const QUOTED = String.raw`"(?:[^"\\]|\\.)*"`;
const AUTH_PARAM = String.raw`[a-z_]+=${QUOTED}`;
const CHALLENGE = new RegExp(`^Bearer ${AUTH_PARAM}(?:, ${AUTH_PARAM})*$`);
// RFC 6750 §3: error_description = 1*( %x20-21 / %x23-5B / %x5D-7E )
const ERROR_DESCRIPTION_CHARSET = /^[\x20-\x21\x23-\x5B\x5D-\x7E]+$/;

const FAILURES = Object.keys(MCP_BEARER_FAILURE_DESCRIPTIONS) as McpBearerTokenFailure[];

describe("mcpBearerChallenge", () => {
  it("carries only discovery parameters when no token was presented", () => {
    expect(mcpBearerChallenge(REQUEST_URL, null)).toBe(
      `Bearer resource_metadata="${METADATA_URL}", scope="${AGENT_OAUTH_DEFAULT_SCOPE_HINT}"`
    );
  });

  it.each(FAILURES)("adds invalid_token and a description for %s", (failure) => {
    expect(mcpBearerChallenge(REQUEST_URL, failure)).toBe(
      `Bearer resource_metadata="${METADATA_URL}", scope="${AGENT_OAUTH_DEFAULT_SCOPE_HINT}", ` +
        `error="invalid_token", error_description="${MCP_BEARER_FAILURE_DESCRIPTIONS[failure]}"`
    );
  });

  it.each([null, ...FAILURES])("is a well-formed challenge for %s", (failure) => {
    expect(mcpBearerChallenge(REQUEST_URL, failure)).toMatch(CHALLENGE);
  });

  it.each(FAILURES)("keeps the %s description inside RFC 6750's charset", (failure) => {
    expect(MCP_BEARER_FAILURE_DESCRIPTIONS[failure]).toMatch(ERROR_DESCRIPTION_CHARSET);
  });
});

describe("quotedString", () => {
  it("escapes double quotes and backslashes", () => {
    expect(quotedString(String.raw`a "b" \c`)).toBe(String.raw`"a \"b\" \\c"`);
  });

  it("leaves other characters alone", () => {
    expect(quotedString("wins:read wins:write")).toBe('"wins:read wins:write"');
  });
});
