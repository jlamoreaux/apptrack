/**
 * @jest-environment node
 */
/**
 * next.config.mjs forbids framing the OAuth pages (clickjacking on the
 * consent screen): every /oauth/* path gets CSP frame-ancestors 'none' and
 * X-Frame-Options DENY, alongside the agent discovery Link headers, which
 * stay unchanged.
 */

import { pathToRegexp } from "next/dist/compiled/path-to-regexp";
import nextConfig from "@/next.config.mjs";
import { agentDiscoveryHeaders } from "@/lib/constants/agent-discovery-links.mjs";

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

async function headerRules(): Promise<HeaderRule[]> {
  if (typeof nextConfig.headers !== "function") throw new Error("next.config has no headers()");
  return nextConfig.headers();
}

function headersFor(rules: HeaderRule[], pathname: string): Record<string, string> {
  const matching = rules.filter((rule) => pathToRegexp(rule.source, []).test(pathname));
  return Object.fromEntries(matching.flatMap((rule) => rule.headers.map((h) => [h.key, h.value])));
}

describe("OAuth framing headers", () => {
  it.each(["/oauth/authorize", "/oauth/consent", "/oauth/error"])("forbid framing %s", async (pathname) => {
    const headers = headersFor(await headerRules(), pathname);
    expect(headers["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
    expect(headers["X-Frame-Options"]).toBe("DENY");
  });

  it("leave other pages alone", async () => {
    const headers = headersFor(await headerRules(), "/dashboard");
    expect(headers["X-Frame-Options"]).toBeUndefined();
    expect(headers["Content-Security-Policy"]).toBeUndefined();
  });

  it("keep the agent discovery headers", async () => {
    expect(await headerRules()).toEqual(expect.arrayContaining(agentDiscoveryHeaders()));
  });
});
