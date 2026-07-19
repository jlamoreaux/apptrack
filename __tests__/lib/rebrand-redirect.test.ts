/**
 * Brand-migration redirect contract (M1). The load-bearing assertion is the
 * roast permalink: a legacy apptrack.ing host must 301 page-for-page to the
 * canonical origin forever, because shared links are the acquisition funnel.
 *
 * Expectations use CANONICAL_ORIGIN (env-driven; defaults to https://careerotter.io
 * in production, resolves to the .env value under test) so the test asserts the
 * mapping behavior rather than a hardcoded host.
 */

// @jest-environment node

import {
  resolveLegacyRedirect,
  LEGACY_HOSTS,
  CANONICAL_ORIGIN,
} from "@/lib/rebrand-redirect";

describe("resolveLegacyRedirect", () => {
  it("maps a roast permalink page-for-page (the must-not-break case)", () => {
    expect(resolveLegacyRedirect("apptrack.ing", "/roast/abc123")).toBe(
      `${CANONICAL_ORIGIN}/roast/abc123`
    );
    expect(resolveLegacyRedirect("www.apptrack.ing", "/roast/abc123")).toBe(
      `${CANONICAL_ORIGIN}/roast/abc123`
    );
  });

  it("preserves the full path and query string", () => {
    expect(
      resolveLegacyRedirect("apptrack.ing", "/career?utm_source=email&x=1")
    ).toBe(`${CANONICAL_ORIGIN}/career?utm_source=email&x=1`);
  });

  it("redirects the root", () => {
    expect(resolveLegacyRedirect("apptrack.ing", "/")).toBe(
      `${CANONICAL_ORIGIN}/`
    );
  });

  it("ignores the port on the host header", () => {
    expect(resolveLegacyRedirect("apptrack.ing:443", "/roast/x")).toBe(
      `${CANONICAL_ORIGIN}/roast/x`
    );
  });

  it("is case-insensitive on the host", () => {
    expect(resolveLegacyRedirect("AppTrack.ing", "/roast/x")).toBe(
      `${CANONICAL_ORIGIN}/roast/x`
    );
  });

  it("does NOT redirect an unrelated / already-canonical host", () => {
    expect(resolveLegacyRedirect("careerotter.io", "/roast/x")).toBeNull();
    expect(resolveLegacyRedirect("localhost:3000", "/roast/x")).toBeNull();
    expect(resolveLegacyRedirect("", "/roast/x")).toBeNull();
  });

  it("every legacy host resolves to the canonical origin", () => {
    for (const host of LEGACY_HOSTS) {
      expect(resolveLegacyRedirect(host, "/x")).toBe(`${CANONICAL_ORIGIN}/x`);
    }
  });
});
