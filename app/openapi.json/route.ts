import { SITE_CONFIG, SUPPORT_EMAIL } from "@/lib/constants/site-config";

/**
 * OpenAPI 3.1 description of the *public* API only — the two unauthenticated,
 * read-only endpoints. The session-cookie routes the first-party app uses are
 * intentionally absent: describing them would advertise access an agent has no
 * way to obtain.
 *
 * Referenced as `rel="service-desc"` from the homepage Link header and as
 * `service-desc` in /.well-known/api-catalog.
 */

export const dynamic = "force-static";

export function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: `${SITE_CONFIG.name} Public API`,
      version: "1.0.0",
      summary: "Unauthenticated, read-only endpoints.",
      description:
        "CareerOtter's public API surface. Everything here is unauthenticated and read-only. Routes not described here require a first-party session cookie and are not available to third-party clients.",
      contact: { name: `${SITE_CONFIG.name} support`, email: SUPPORT_EMAIL },
      termsOfService: `${SITE_CONFIG.url}/terms`,
    },
    servers: [{ url: SITE_CONFIG.url }],
    paths: {
      "/api/health": {
        get: {
          operationId: "getHealth",
          summary: "Service liveness",
          description:
            "Returns 200 with a fixed payload whenever the service is serving requests.",
          responses: {
            "200": {
              description: "The service is up.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Health" },
                },
              },
            },
          },
        },
      },
      "/api/roast/{shareableId}": {
        get: {
          operationId: "getRoast",
          summary: "Read a shared Resume Roast",
          description:
            "Reads a Resume Roast by the identifier in its /roast/{shareableId} permalink. Roasts expire; an expired one returns 410 rather than 404 so a client can tell a dead link from a stale one.",
          parameters: [
            {
              name: "shareableId",
              in: "path",
              required: true,
              description: "Last path segment of a /roast/... permalink.",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "The roast.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Roast" },
                },
              },
            },
            "404": {
              description: "No roast with that identifier.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "410": {
              description: "The roast existed but has expired.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Health: {
          type: "object",
          required: ["status", "service", "time"],
          properties: {
            status: { type: "string", const: "ok" },
            service: { type: "string" },
            time: { type: "string", format: "date-time" },
          },
        },
        Roast: {
          type: "object",
          required: ["content", "score", "scoreLabel", "createdAt", "viewCount"],
          properties: {
            content: { type: "string", description: "Roast text, in markdown." },
            score: { type: "integer", minimum: 0, maximum: 100 },
            scoreLabel: { type: "string" },
            firstName: {
              type: ["string", "null"],
              description: "First name the person supplied, if any.",
            },
            categories: {
              type: ["array", "null"],
              description: "Per-category breakdown of the score.",
              items: { type: "object", additionalProperties: true },
            },
            createdAt: { type: "string", format: "date-time" },
            viewCount: { type: "integer", minimum: 0 },
          },
        },
        Error: {
          type: "object",
          required: ["error"],
          properties: { error: { type: "string" } },
        },
      },
    },
  };

  // Built with a plain Response rather than NextResponse.json so the
  // `application/openapi+json` media type survives — NextResponse.json forces
  // `application/json`.
  return new Response(JSON.stringify(spec, null, 2), {
    headers: {
      "Content-Type": "application/openapi+json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
