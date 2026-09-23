// @jest-environment node
/**
 * Tests for lib/auth/oauth/redirect-uri.ts:
 * - registration matrix: https accepted unless on one of our hosts (also with
 *   a trailing dot or different case), loopback http with and without a port,
 *   other http rejected, private-use schemes accepted, every denylisted
 *   scheme rejected, fragments and credentials rejected, count and length
 *   limits
 * - matching: exact for everything but loopback, where only the port may
 *   differ
 * - display text for each kind
 */

import {
  matchRegisteredRedirectUri,
  redirectUriDisplay,
  validateRedirectUris,
} from "@/lib/auth/oauth/redirect-uri";
import {
  AGENT_OAUTH_DENIED_REDIRECT_SCHEMES,
  AGENT_OAUTH_LIMITS,
} from "@/lib/constants/agent-oauth";

const OUR_ORIGINS = ["https://careerotter.io", "https://www.careerotter.io"];

function validate(...uris: string[]) {
  return validateRedirectUris(uris, OUR_ORIGINS);
}

describe("validateRedirectUris", () => {
  it.each([
    ["https://claude.ai/api/mcp/auth_callback", "https"],
    ["https://example.com:8443/cb?x=1", "https"],
    ["http://127.0.0.1/callback", "loopback"],
    ["http://127.0.0.1:33418/callback", "loopback"],
    ["http://[::1]:8080/cb", "loopback"],
    ["http://localhost/cb", "loopback"],
    ["http://localhost:6274/oauth/callback", "loopback"],
    ["cursor://anysphere.cursor-retrieval/oauth/callback", "private_use"],
    ["com.example.app:/oauth2redirect", "private_use"],
  ])("accepts %s as %s", (uri, kind) => {
    expect(validate(uri)).toEqual({ ok: true, kinds: [kind] });
  });

  it("returns each URI's kind in order", () => {
    expect(validate("https://claude.ai/cb", "http://localhost:1/cb", "cursor://cb")).toEqual({
      ok: true,
      kinds: ["https", "loopback", "private_use"],
    });
  });

  it.each([
    "https://careerotter.io/oauth/callback",
    "https://www.careerotter.io/cb",
    "https://CAREEROTTER.IO/cb",
    "https://careerotter.io./cb",
    "https://careerotter.io:8443/cb",
  ])("rejects our own host: %s", (uri) => {
    expect(validate(uri)).toEqual({ ok: false, message: expect.stringContaining("CareerOtter") });
  });

  it.each([
    "http://example.com/cb",
    "http://127.0.0.2/cb",
    "http://localhost.example.com/cb",
    "http://localhost@evil.example/cb",
  ])("rejects non-loopback http: %s", (uri) => {
    expect(validate(uri).ok).toBe(false);
  });

  it.each(AGENT_OAUTH_DENIED_REDIRECT_SCHEMES.filter((scheme) => scheme !== "http" && scheme !== "https"))(
    "rejects the denylisted scheme %s",
    (scheme) => {
      expect(validate(`${scheme}://host/path`).ok).toBe(false);
      expect(validate(`${scheme}:opaque`).ok).toBe(false);
    }
  );

  it("rejects schemes shorter than the private-use pattern allows", () => {
    expect(validate("ab://cb").ok).toBe(false);
  });

  it.each(["https://claude.ai/cb#frag", "https://claude.ai/cb#", "cursor://cb#x", "http://localhost/cb#"])(
    "rejects a fragment: %s",
    (uri) => {
      expect(validate(uri)).toEqual({ ok: false, message: expect.stringContaining("fragment") });
    }
  );

  it("rejects credentials in the URI", () => {
    expect(validate("https://user:pass@claude.ai/cb").ok).toBe(false);
  });

  it("rejects relative and empty URIs", () => {
    expect(validate("/callback").ok).toBe(false);
    expect(validate("").ok).toBe(false);
  });

  it("enforces the count limit", () => {
    expect(validate().ok).toBe(false);
    const five = Array.from({ length: AGENT_OAUTH_LIMITS.redirectUrisMax }, (_, i) => `https://claude.ai/${i}`);
    expect(validate(...five).ok).toBe(true);
    expect(validate(...five, "https://claude.ai/extra").ok).toBe(false);
  });

  it("enforces the length limit", () => {
    const base = "https://claude.ai/";
    const atLimit = base + "a".repeat(AGENT_OAUTH_LIMITS.redirectUriMaxLength - base.length);
    expect(validate(atLimit).ok).toBe(true);
    expect(validate(`${atLimit}a`).ok).toBe(false);
  });
});

describe("matchRegisteredRedirectUri", () => {
  const registered = [
    "https://claude.ai/api/mcp/auth_callback",
    "http://127.0.0.1:33418/callback?x=1",
    "http://localhost/cb",
    "cursor://anysphere/cb",
  ];

  it("matches exactly, returning the registered string", () => {
    for (const uri of registered) expect(matchRegisteredRedirectUri(uri, registered)).toBe(uri);
  });

  it("ignores the port for loopback URIs", () => {
    expect(matchRegisteredRedirectUri("http://127.0.0.1:50000/callback?x=1", registered)).toBe(
      "http://127.0.0.1:33418/callback?x=1"
    );
    expect(matchRegisteredRedirectUri("http://127.0.0.1/callback?x=1", registered)).toBe(
      "http://127.0.0.1:33418/callback?x=1"
    );
    expect(matchRegisteredRedirectUri("http://localhost:9999/cb", registered)).toBe("http://localhost/cb");
  });

  it("still requires the loopback host, path and query to match exactly", () => {
    expect(matchRegisteredRedirectUri("http://localhost:1/callback?x=1", registered)).toBeNull();
    expect(matchRegisteredRedirectUri("http://127.0.0.1:1/callback?x=2", registered)).toBeNull();
    expect(matchRegisteredRedirectUri("http://127.0.0.1:1/callback", registered)).toBeNull();
    expect(matchRegisteredRedirectUri("http://127.0.0.1:1/Callback?x=1", registered)).toBeNull();
    expect(matchRegisteredRedirectUri("http://localhost:1/cb/", registered)).toBeNull();
    expect(matchRegisteredRedirectUri("http://localhost:1/cb#x", registered)).toBeNull();
    expect(matchRegisteredRedirectUri("https://localhost/cb", registered)).toBeNull();
  });

  it("is exact for non-loopback URIs", () => {
    expect(matchRegisteredRedirectUri("https://claude.ai:443/api/mcp/auth_callback", registered)).toBeNull();
    expect(matchRegisteredRedirectUri("https://claude.ai/api/mcp/auth_callback/", registered)).toBeNull();
    expect(matchRegisteredRedirectUri("https://CLAUDE.ai/api/mcp/auth_callback", registered)).toBeNull();
    expect(matchRegisteredRedirectUri("cursor://anysphere/cb?x", registered)).toBeNull();
  });
});

describe("redirectUriDisplay", () => {
  it("shows the hostname for https", () => {
    expect(redirectUriDisplay("https://claude.ai/api/mcp/auth_callback")).toBe("claude.ai");
  });

  it("describes loopback URIs as an app on this computer", () => {
    expect(redirectUriDisplay("http://127.0.0.1:33418/cb")).toBe("an app on this computer (localhost:33418)");
    expect(redirectUriDisplay("http://[::1]:8080/cb")).toBe("an app on this computer (localhost:8080)");
    expect(redirectUriDisplay("http://localhost/cb")).toBe("an app on this computer (localhost)");
  });

  it("names the app for a private-use scheme", () => {
    expect(redirectUriDisplay("cursor://anysphere/cb")).toBe("the cursor app");
  });
});
