import { SITE_CONFIG } from "@/lib/constants/site-config";

/**
 * robots.txt is hand-rendered rather than generated from Next's
 * `MetadataRoute.Robots` helper because that helper can only emit the classic
 * crawl directives — it has no way to express the `Content-Signal` line below.
 */

export const dynamic = "force-static";

/**
 * Content Signals (https://contentsignals.org,
 * draft-romm-aipref-contentsignals) state how content may be *used* once it has
 * been fetched, which robots.txt's allow/disallow rules say nothing about.
 *
 * search   — index the page and link back to it.
 * ai-input — quote or ground a live AI answer in it, with attribution.
 * ai-train — train or fine-tune a generative model on it. Reserved.
 */
const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";

const DISALLOWED = [
  "/api/",
  "/dashboard/",
  "/admin/",
  "/onboarding/",
  "/auth/",
  "/_next/static/",
  "/_next/image/",
];

export function GET(): Response {
  const body = [
    "# CareerOtter",
    "#",
    "# The Content-Signal line below declares how this content may be used after",
    "# it is fetched, which the crawl rules alone do not cover. Search indexing",
    "# and grounding live AI answers are permitted; training generative models on",
    "# this content is not. See https://contentsignals.org.",
    "",
    "User-agent: *",
    `Content-Signal: ${CONTENT_SIGNAL}`,
    "Allow: /",
    ...DISALLOWED.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${SITE_CONFIG.url}/sitemap.xml`,
    "",
    "# Agent discovery",
    `# ${SITE_CONFIG.url}/llms.txt`,
    `# ${SITE_CONFIG.url}/.well-known/api-catalog`,
    `# ${SITE_CONFIG.url}/.well-known/ai-catalog.json`,
    `# ${SITE_CONFIG.url}/.well-known/agent-skills/index.json`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
