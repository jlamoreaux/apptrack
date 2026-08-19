import { SITE_CONFIG } from "@/lib/constants/site-config";
import { AGENT_SKILLS, skillUrl } from "@/lib/agent-discovery/skills";

/**
 * /.well-known/ai-catalog.json — Agentic Resource Discovery manifest
 * (https://agenticresourcediscovery.org). Lists the machine-readable resources
 * this origin publishes so a registry can index them.
 *
 * Entries carry `representativeQueries` so registries can build semantic
 * embeddings; each entry must have exactly one of `url` or `data`.
 */

export const dynamic = "force-static";

const HOST_DOMAIN = new URL(SITE_CONFIG.url).hostname;

function url(pathname: string): string {
  return `${SITE_CONFIG.url}${pathname}`;
}

function urn(namespace: string, name: string): string {
  return `urn:air:${HOST_DOMAIN}:${namespace}:${name}`;
}

export function GET(): Response {
  const manifest = {
    specVersion: "1.0",
    host: {
      displayName: SITE_CONFIG.name,
      identifier: `did:web:${HOST_DOMAIN}`,
      documentationUrl: url("/llms.txt"),
      logoUrl: url("/icon.svg"),
    },
    entries: [
      {
        identifier: urn("api", "public"),
        displayName: `${SITE_CONFIG.name} Public API`,
        type: "application/openapi+json",
        url: url("/openapi.json"),
        description:
          "Unauthenticated, read-only HTTP API: service liveness and read access to shared Resume Roast results.",
        tags: ["career", "resume", "job-search"],
        representativeQueries: [
          "read a shared CareerOtter resume roast by its link",
          "what score did this resume roast get",
          "is the CareerOtter API up",
        ],
      },
      {
        identifier: urn("catalog", "api-catalog"),
        displayName: "API catalog (RFC 9727)",
        type: "application/linkset+json",
        url: url("/.well-known/api-catalog"),
        description:
          "Linkset pointing at the OpenAPI description, agent documentation, and status endpoint for the public API.",
        representativeQueries: [
          "where is CareerOtter's API documentation",
          "list CareerOtter's public APIs",
        ],
      },
      {
        identifier: urn("docs", "llms-txt"),
        displayName: `${SITE_CONFIG.name} for agents`,
        type: "text/plain",
        url: url("/llms.txt"),
        description:
          "Compact map of the site for agents: free tools, pricing, public API, blog, and content-usage terms.",
        representativeQueries: [
          "what does CareerOtter do",
          "what free job search tools does CareerOtter offer",
          "how much does CareerOtter cost",
        ],
      },
      {
        identifier: urn("skills", "index"),
        displayName: "Agent Skills index",
        type: "application/json",
        url: url("/.well-known/agent-skills/index.json"),
        description: `Agent Skills Discovery index listing ${AGENT_SKILLS.length} skills for working with CareerOtter.`,
        representativeQueries: [
          "how do I use CareerOtter's resume roast",
          "what agent skills does CareerOtter publish",
        ],
      },
      ...AGENT_SKILLS.map((skill) => ({
        identifier: urn("skill", skill.name),
        displayName: skill.name,
        type: "text/markdown",
        url: url(skillUrl(skill.name)),
        description: skill.description,
        representativeQueries: [
          `how to use ${skill.name.replace(/^careerotter-/, "CareerOtter ").replace(/-/g, " ")}`,
          "help me with my job search using CareerOtter",
        ],
      })),
    ],
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
