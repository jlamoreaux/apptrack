/**
 * Tests for lib/utils/auth-redirect.ts, the helpers every login, sign-up and
 * onboarding redirect goes through:
 * - validInternalPath resolves against the page's origin in the browser (or
 *   the one given) and returns the parsed path, so /\t/evil.com and friends,
 *   raw or percent-encoded, never come back; legitimate paths with queries do
 * - repeated values (a Next.js searchParams array) are refused
 * - loginHref, signupHref, onboardingHref and authCallbackUrl encode the
 *   destination so it round-trips through URLSearchParams
 */

import {
  authCallbackUrl,
  loginHref,
  onboardingHref,
  redirectOrigin,
  signupHref,
  validInternalPath,
} from "@/lib/utils/auth-redirect";

const OFF_ORIGIN_INPUTS = [
  "/\t/evil.com",
  "/\n/evil.com",
  "/\r/evil.com",
  "/%09/evil.com",
  "/%0a/evil.com",
  "/%0d/evil.com",
  "/\\evil.com",
  "//evil.com",
  "/%2F%2Fevil.com",
  "%2F%2Fevil.com",
  "https://evil.com/",
];

/** What a page reading `?redirectTo=<raw>` sees. */
function fromQuery(raw: string): string | null {
  return new URLSearchParams(`redirectTo=${raw}`).get("redirectTo");
}

describe("validInternalPath", () => {
  it("resolves against the page's own origin in the browser", () => {
    expect(redirectOrigin()).toBe(window.location.origin);
  });

  it.each(OFF_ORIGIN_INPUTS)("never navigates off-origin for %j, raw or decoded", (input) => {
    for (const value of [input, fromQuery(input)]) {
      const path = validInternalPath(value);
      if (path === null) continue;
      expect(path.startsWith("/")).toBe(true);
      expect(path.startsWith("//")).toBe(false);
      expect(new URL(path, window.location.origin).origin).toBe(window.location.origin);
    }
  });

  it.each(["/\t/evil.com", "/\n/evil.com", "/\r/evil.com", "/\\evil.com", "//evil.com"])(
    "drops %j",
    (input) => {
      expect(validInternalPath(input)).toBeNull();
      expect(validInternalPath(input, "https://careerotter.io")).toBeNull();
    }
  );

  it.each(["/%09/evil.com", "/%0a/evil.com", "/%0d/evil.com", "/%2F%2Fevil.com"])(
    "drops %j once URLSearchParams decodes it",
    (raw) => {
      expect(validInternalPath(fromQuery(raw))).toBeNull();
    }
  );

  it("keeps legitimate paths with their query", () => {
    const consent = "/oauth/consent?response_type=code&client_id=co_client_x&state=a+b&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcb";
    expect(validInternalPath(consent)).toBe(consent);
    expect(validInternalPath(fromQuery(encodeURIComponent(consent)))).toBe(consent);
    expect(validInternalPath("/dashboard/comp?tab=offers#compare", "https://careerotter.io")).toBe(
      "/dashboard/comp?tab=offers#compare"
    );
  });

  it("refuses a repeated value", () => {
    expect(validInternalPath(["/dashboard", "/dashboard"])).toBeNull();
    expect(validInternalPath(undefined)).toBeNull();
    expect(validInternalPath(null)).toBeNull();
  });
});

describe("hrefs", () => {
  const path = "/oauth/consent?client_id=a&state=x";

  it.each([
    ["loginHref", loginHref(path), "/login", "redirectTo"],
    ["signupHref", signupHref(path), "/signup", "redirectTo"],
    ["onboardingHref", onboardingHref(path), "/onboarding/welcome", "next"],
  ])("%s carries the destination encoded", (_label, href, pathname, param) => {
    const url = new URL(href, "https://careerotter.io");
    expect(url.pathname).toBe(pathname);
    expect(url.searchParams.get(param)).toBe(path);
  });

  it("builds the auth callback, with or without next", () => {
    expect(authCallbackUrl("https://careerotter.io", null)).toBe("https://careerotter.io/auth/callback");
    const url = new URL(authCallbackUrl("https://careerotter.io", path));
    expect(url.pathname).toBe("/auth/callback");
    expect(url.searchParams.get("next")).toBe(path);
  });

  it("leaves a destination-less login or sign-up href bare", () => {
    expect(loginHref(null)).toBe("/login");
    expect(signupHref(null)).toBe("/signup");
  });
});
