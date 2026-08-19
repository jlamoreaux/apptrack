import { SITE_CONFIG } from "@/lib/constants/site-config";

/**
 * /.well-known/api-catalog — RFC 9727 API catalog, served as an RFC 9264
 * linkset. One entry, because CareerOtter has exactly one public API.
 */

export const dynamic = "force-static";

function url(pathname: string): string {
  return `${SITE_CONFIG.url}${pathname}`;
}

export function GET(): Response {
  const linkset = {
    linkset: [
      {
        anchor: url("/api"),
        "service-desc": [
          {
            href: url("/openapi.json"),
            type: "application/openapi+json",
            title: `${SITE_CONFIG.name} Public API (OpenAPI 3.1)`,
          },
        ],
        "service-doc": [
          {
            href: url("/llms.txt"),
            type: "text/plain",
            title: `${SITE_CONFIG.name} for agents`,
          },
        ],
        "service-meta": [
          {
            href: url("/.well-known/ai-catalog.json"),
            type: "application/json",
            title: "Agentic Resource Discovery manifest",
          },
        ],
        status: [
          {
            href: url("/api/health"),
            type: "application/json",
            title: "Service liveness",
          },
        ],
        "terms-of-service": [
          { href: url("/terms"), type: "text/html", title: "Terms of service" },
        ],
      },
    ],
  };

  return new Response(JSON.stringify(linkset, null, 2), {
    headers: {
      "Content-Type": "application/linkset+json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
