// @jest-environment node
/**
 * Tests for lib/auth/oauth/resource.ts: normalization (trailing slash, host
 * case, default port), the accepted set (SITE_URL, plus www when configured),
 * foreign resources rejected, and the advertised resource falling back to
 * SITE_URL for an unaccepted (spoofed) origin.
 */

import {
  advertisedMcpResource,
  normalizeResource,
  toAcceptedMcpResource,
} from "@/lib/auth/oauth/resource";
import { CANONICAL_MCP_RESOURCE } from "@/lib/constants/agent-oauth";
import { MCP_RESOURCE_PATH } from "@/lib/constants/agent-access";
import { SITE_URL } from "@/lib/constants/site-config";

const EXTRA_ORIGIN = "https://www.careerotter.io";
const siteHost = new URL(SITE_URL).host;
const siteScheme = new URL(SITE_URL).protocol;

let savedExtraOrigins: string | undefined;

beforeEach(() => {
  savedExtraOrigins = process.env.CAREEROTTER_MCP_EXTRA_ORIGINS;
  delete process.env.CAREEROTTER_MCP_EXTRA_ORIGINS;
});

afterEach(() => {
  if (savedExtraOrigins === undefined) delete process.env.CAREEROTTER_MCP_EXTRA_ORIGINS;
  else process.env.CAREEROTTER_MCP_EXTRA_ORIGINS = savedExtraOrigins;
});

describe("normalizeResource", () => {
  it("lowercases the scheme and host, drops a default port and one trailing slash", () => {
    expect(normalizeResource("HTTPS://Example.COM:443/api/mcp/")).toBe("https://example.com/api/mcp");
    expect(normalizeResource("http://example.com:80/api/mcp")).toBe("http://example.com/api/mcp");
  });

  it("keeps a non-default port, the path case and the query", () => {
    expect(normalizeResource("https://example.com:8443/API/mcp?x=1")).toBe(
      "https://example.com:8443/API/mcp?x=1"
    );
  });

  it("drops only one trailing slash", () => {
    expect(normalizeResource("https://example.com/api/mcp//")).toBe("https://example.com/api/mcp/");
  });

  it("rejects non-URLs, fragments and credentials", () => {
    expect(normalizeResource("api/mcp")).toBeNull();
    expect(normalizeResource("https://example.com/api/mcp#x")).toBeNull();
    expect(normalizeResource("https://u:p@example.com/api/mcp")).toBeNull();
  });
});

describe("toAcceptedMcpResource", () => {
  it("accepts the canonical resource and its normalizable variants", () => {
    expect(toAcceptedMcpResource(CANONICAL_MCP_RESOURCE)).toBe(CANONICAL_MCP_RESOURCE);
    expect(toAcceptedMcpResource(`${CANONICAL_MCP_RESOURCE}/`)).toBe(CANONICAL_MCP_RESOURCE);
    expect(toAcceptedMcpResource(`${siteScheme.toUpperCase()}//${siteHost.toUpperCase()}${MCP_RESOURCE_PATH}`)).toBe(
      CANONICAL_MCP_RESOURCE
    );
  });

  it("accepts an explicit default port", () => {
    // SITE_URL is an origin, so it never carries its scheme's default port.
    const defaultPort = siteScheme === "https:" ? "443" : "80";
    const withPort = `${siteScheme}//${siteHost}:${defaultPort}${MCP_RESOURCE_PATH}`;
    expect(toAcceptedMcpResource(withPort)).toBe(CANONICAL_MCP_RESOURCE);
  });

  it("accepts www only when it is configured", () => {
    const www = `${EXTRA_ORIGIN}${MCP_RESOURCE_PATH}`;
    expect(toAcceptedMcpResource(www)).toBeNull();
    process.env.CAREEROTTER_MCP_EXTRA_ORIGINS = EXTRA_ORIGIN;
    expect(toAcceptedMcpResource(`${www}/`)).toBe(www);
  });

  it.each([
    "https://evil.example/api/mcp",
    `${SITE_URL}/api/mcp/extra`,
    `${SITE_URL}/api`,
    SITE_URL,
    `${CANONICAL_MCP_RESOURCE}?x=1`,
  ])("rejects %s", (resource) => {
    expect(toAcceptedMcpResource(resource)).toBeNull();
  });
});

describe("advertisedMcpResource", () => {
  it("uses the request origin when it is accepted", () => {
    process.env.CAREEROTTER_MCP_EXTRA_ORIGINS = EXTRA_ORIGIN;
    expect(advertisedMcpResource(`${EXTRA_ORIGIN}/.well-known/oauth-protected-resource`)).toBe(
      `${EXTRA_ORIGIN}${MCP_RESOURCE_PATH}`
    );
  });

  it("falls back to SITE_URL for an origin that isn't accepted", () => {
    expect(advertisedMcpResource("https://evil.example/.well-known/oauth-protected-resource")).toBe(
      CANONICAL_MCP_RESOURCE
    );
  });
});
