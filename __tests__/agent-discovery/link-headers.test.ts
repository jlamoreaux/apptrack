/**
 * The Link header config is the only thing putting an `api-catalog` relation on
 * /.well-known/api-catalog, which RFC 9727 Section 2 requires a HEAD on that URI
 * to return. Next implements HEAD from the GET handler, so the header rules are
 * what conformance actually rests on — hence these assertions on the patterns.
 */

import { pathToRegexp } from "next/dist/compiled/path-to-regexp";
import {
  AGENT_DISCOVERY_LINK,
  LINK_HEADER_SOURCES,
  VARY_ACCEPT_SOURCES,
  agentDiscoveryHeaders,
} from "@/lib/constants/agent-discovery-links.mjs";

function matchingSources(sources: string[], pathname: string): string[] {
  return sources.filter((source) => pathToRegexp(source, []).test(pathname));
}

describe("agent discovery Link header", () => {
  it("advertises only IANA-registered relation types", () => {
    const relations = [...AGENT_DISCOVERY_LINK.matchAll(/rel="([^"]+)"/g)].map((m) => m[1]);

    expect(relations).toEqual([
      "api-catalog",
      "service-desc",
      "service-doc",
      "service-meta",
      "describedby",
      "terms-of-service",
      "privacy-policy",
    ]);
  });

  it("covers the api-catalog itself, so its HEAD response carries the relation", () => {
    expect(matchingSources(LINK_HEADER_SOURCES, "/.well-known/api-catalog")).toHaveLength(1);
    expect(AGENT_DISCOVERY_LINK).toContain('</.well-known/api-catalog>; rel="api-catalog"');
  });

  it("covers the homepage and the other discovery documents exactly once each", () => {
    for (const pathname of [
      "/",
      "/free-tools",
      "/blog/how-to-track-job-applications",
      "/.well-known/ai-catalog.json",
      "/.well-known/agent-skills/index.json",
      "/openapi.json",
      "/llms.txt",
    ]) {
      expect(matchingSources(LINK_HEADER_SOURCES, pathname)).toHaveLength(1);
    }
  });

  it("keeps the header off static assets and API responses", () => {
    for (const pathname of ["/_next/static/chunk.js", "/api/health", "/api/markdown"]) {
      expect(matchingSources(LINK_HEADER_SOURCES, pathname)).toHaveLength(0);
    }
  });
});

describe("Vary: Accept", () => {
  it("is set on every path with a markdown rendering", () => {
    for (const pathname of ["/", "/free-tools", "/blog", "/blog/some-post"]) {
      expect(matchingSources(VARY_ACCEPT_SOURCES, pathname).length).toBeGreaterThan(0);
    }
  });
});

describe("agentDiscoveryHeaders", () => {
  it("emits header rules Next can consume", () => {
    for (const rule of agentDiscoveryHeaders()) {
      expect(typeof rule.source).toBe("string");
      for (const header of rule.headers) {
        expect(typeof header.key).toBe("string");
        expect(typeof header.value).toBe("string");
      }
    }
  });
});
