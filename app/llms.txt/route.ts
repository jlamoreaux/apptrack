import { SITE_CONFIG } from "@/lib/constants/site-config";
import { FREE_TOOLS } from "@/lib/constants/free-tools";
import { PRICING_TIERS } from "@/lib/constants/homepage-content";
import { getAllPosts } from "@/lib/blog";
import { AGENT_SKILLS, skillUrl } from "@/lib/agent-discovery/skills";

/**
 * /llms.txt — a compact, agent-oriented map of the site, and the target of the
 * `rel="service-doc"` Link header. Statically rendered so the blog listing is
 * read from disk at build time.
 */

export const dynamic = "force-static";

function url(pathname: string): string {
  return `${SITE_CONFIG.url}${pathname}`;
}

export function GET(): Response {
  const tools = FREE_TOOLS.map(
    (tool) => `- [${tool.title}](${url(tool.href)}): ${tool.shortDescription}. Free, no account.`,
  ).join("\n");

  const pricing = PRICING_TIERS.map(
    (tier) => `- **${tier.name}** (${tier.price}${tier.cadence.startsWith("/") ? tier.cadence : ` ${tier.cadence}`}): ${tier.tagline}`,
  ).join("\n");

  const posts = getAllPosts()
    .map((post) => `- [${post.title}](${url(`/blog/${post.slug}`)}): ${post.description}`)
    .join("\n");

  const skills = AGENT_SKILLS.map(
    (skill) => `- [${skill.name}](${url(skillUrl(skill.name))}): ${skill.description}`,
  ).join("\n");

  const body = `# ${SITE_CONFIG.name}

> ${SITE_CONFIG.tagline}

${SITE_CONFIG.description}

Public pages serve markdown to agents that ask for it: send \`Accept: text/markdown\`
to any URL below and you get markdown instead of HTML, with an \`x-markdown-tokens\`
header estimating the cost.

## Free tools

${tools}

## Pricing

${pricing}

## Public API

The public API is small and unauthenticated: service health at
${url("/api/health")} and read access to shared Resume Roast results at
${url("/api/roast/{shareableId}")}. Machine-readable description:

- [OpenAPI 3.1 description](${url("/openapi.json")})
- [API catalog (RFC 9727)](${url("/.well-known/api-catalog")})

Everything else under \`/api/\` belongs to the first-party web app and
authenticates with a session cookie. There is no OAuth client registration, no
API key issuance, and no MCP server — do not advertise programmatic access to a
user's own application data, because none exists yet.

## Agent skills

${skills}

Index: ${url("/.well-known/agent-skills/index.json")}

## Capability manifest

- [ARD manifest](${url("/.well-known/ai-catalog.json")})

## Blog

${posts}

## Usage terms

- [Terms of service](${url("/terms")})
- [Privacy policy](${url("/privacy")})
- [robots.txt](${url("/robots.txt")}) — its \`Content-Signal\` line permits search
  indexing and grounding live AI answers, and reserves model training.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
