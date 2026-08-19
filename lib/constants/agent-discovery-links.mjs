/**
 * RFC 8288 Link headers advertising this origin's agent-facing resources.
 *
 * Plain `.mjs` because next.config.mjs is loaded by Node directly and cannot
 * import TypeScript — this is the one shared constants module that has to be.
 *
 * All relation types are IANA-registered (`api-catalog` from RFC 9727,
 * `service-desc`/`service-doc`/`service-meta` from RFC 8631, `describedby`,
 * `terms-of-service`, `privacy-policy`); an unregistered bare token would not be
 * a conforming relation type. Targets are relative URI references, so they
 * resolve against whichever origin served the response.
 */
export const AGENT_DISCOVERY_LINK = [
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</openapi.json>; rel="service-desc"; type="application/openapi+json"',
  '</llms.txt>; rel="service-doc"; type="text/plain"',
  '</.well-known/ai-catalog.json>; rel="service-meta"; type="application/json"',
  '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"',
  '</terms>; rel="terms-of-service"; type="text/html"',
  '</privacy>; rel="privacy-policy"; type="text/html"',
].join(", ");

const LINK_HEADER = { key: "Link", value: AGENT_DISCOVERY_LINK };

// Paths that serve markdown or HTML depending on Accept (see middleware.ts)
// must tell caches to key on it.
const VARY_ACCEPT = { key: "Vary", value: "Accept" };

/**
 * Sources carrying the Link header. Split so `/` and everything below it are
 * matched by exactly one rule — overlapping rules would emit the header twice.
 * The `.+` in the second pattern is what keeps it from also matching the root.
 *
 * The second pattern must keep matching `/.well-known/api-catalog`: RFC 9727
 * Section 2 requires a HEAD on that URI to answer with a Link header carrying
 * the `api-catalog` relation, and this is what puts it there (Next implements
 * HEAD from the GET handler automatically).
 */
export const LINK_HEADER_SOURCES = ["/", "/:path((?!_next/|api/).+)"];

/** Paths whose representation varies on the Accept header. */
export const VARY_ACCEPT_SOURCES = ["/", "/free-tools", "/blog", "/blog/:slug"];

export function agentDiscoveryHeaders() {
  return [
    ...LINK_HEADER_SOURCES.map((source) => ({ source, headers: [LINK_HEADER] })),
    ...VARY_ACCEPT_SOURCES.map((source) => ({ source, headers: [VARY_ACCEPT] })),
  ];
}
