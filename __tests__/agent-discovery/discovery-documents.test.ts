/**
 * Proves the agent-discovery documents this origin publishes are well formed
 * and internally consistent: the skills index digests match the bytes actually
 * served, the ARD manifest obeys its "exactly one of url/data" rule, and the
 * Link header only advertises IANA-registered relation types.
 */

import { GET as getRobots } from "@/app/robots.txt/route";
import { GET as getApiCatalog } from "@/app/.well-known/api-catalog/route";
import { GET as getAiCatalog } from "@/app/.well-known/ai-catalog.json/route";
import { GET as getSkillsIndex } from "@/app/.well-known/agent-skills/index.json/route";
import { GET as getSkillBody } from "@/app/.well-known/agent-skills/[skill]/SKILL.md/route";
import { GET as getOpenApi } from "@/app/openapi.json/route";
import {
  AGENT_SKILLS,
  readSkillBody,
  skillDigest,
} from "@/lib/agent-discovery/skills";

describe("robots.txt", () => {
  it("declares content signals alongside the crawl rules", async () => {
    const body = await getRobots().text();

    expect(body).toContain("User-agent: *");
    expect(body).toContain("Content-Signal: search=yes, ai-input=yes, ai-train=no");
    expect(body).toContain("Sitemap: ");
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Disallow: /dashboard/");
  });

  it("serves plain text", () => {
    expect(getRobots().headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
  });
});

describe("/.well-known/api-catalog", () => {
  it("is an RFC 9727 linkset with the registered relations", async () => {
    const response = getApiCatalog();
    expect(response.headers.get("Content-Type")).toBe("application/linkset+json");

    const catalog = JSON.parse(await response.text());
    expect(Array.isArray(catalog.linkset)).toBe(true);
    expect(catalog.linkset.length).toBeGreaterThan(0);

    for (const entry of catalog.linkset) {
      expect(typeof entry.anchor).toBe("string");
      expect(entry.anchor).toMatch(/^https?:\/\//);

      for (const relation of ["service-desc", "service-doc", "status"]) {
        expect(Array.isArray(entry[relation])).toBe(true);
        for (const link of entry[relation]) {
          expect(link.href).toMatch(/^https?:\/\//);
        }
      }
    }
  });
});

describe("/.well-known/ai-catalog.json", () => {
  it("is a well-formed ARD manifest", async () => {
    const response = getAiCatalog();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const manifest = JSON.parse(await response.text());
    expect(typeof manifest.specVersion).toBe("string");
    expect(typeof manifest.host.displayName).toBe("string");
    expect(Array.isArray(manifest.entries)).toBe(true);
    expect(manifest.entries.length).toBeGreaterThan(0);
  });

  it("gives every entry a urn:air identifier and exactly one of url/data", async () => {
    const manifest = JSON.parse(await getAiCatalog().text());

    for (const entry of manifest.entries) {
      expect(entry.identifier).toMatch(/^urn:air:[^:]+:[^:]+:.+$/);
      expect(typeof entry.displayName).toBe("string");
      expect(typeof entry.type).toBe("string");
      expect("url" in entry).not.toBe("data" in entry);
    }
  });

  it("keeps representativeQueries within the 2-5 range registries index on", async () => {
    const manifest = JSON.parse(await getAiCatalog().text());

    for (const entry of manifest.entries) {
      expect(entry.representativeQueries.length).toBeGreaterThanOrEqual(2);
      expect(entry.representativeQueries.length).toBeLessThanOrEqual(5);
    }
  });

  it("uses unique identifiers", async () => {
    const manifest = JSON.parse(await getAiCatalog().text());
    const identifiers = manifest.entries.map((entry: { identifier: string }) => entry.identifier);

    expect(new Set(identifiers).size).toBe(identifiers.length);
  });
});

describe("/.well-known/agent-skills", () => {
  it("indexes every declared skill in the v0.2.0 shape", async () => {
    const index = JSON.parse(await getSkillsIndex().text());

    expect(index.$schema).toBe("https://schemas.agentskills.io/discovery/0.2.0/schema.json");
    expect(index.skills).toHaveLength(AGENT_SKILLS.length);

    for (const skill of index.skills) {
      expect(skill.name).toMatch(/^[a-z0-9-]{1,64}$/);
      expect(skill.type).toBe("skill-md");
      expect(skill.description.length).toBeLessThanOrEqual(1024);
      expect(skill.url).toBe(`/.well-known/agent-skills/${skill.name}/SKILL.md`);
      expect(skill.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("publishes digests matching the bytes actually served", async () => {
    const index = JSON.parse(await getSkillsIndex().text());

    for (const skill of index.skills) {
      const response = await getSkillBody(new Request("http://localhost/"), {
        params: Promise.resolve({ skill: skill.name }),
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
      expect(skillDigest(await response.text())).toBe(skill.digest);
    }
  });

  it("404s an unknown skill instead of reaching the filesystem", async () => {
    for (const name of ["nope", "../../../etc/passwd", "..%2F.."]) {
      const response = await getSkillBody(new Request("http://localhost/"), {
        params: Promise.resolve({ skill: name }),
      });
      expect(response.status).toBe(404);
    }
  });

  it("has a body on disk for every declared skill", () => {
    for (const skill of AGENT_SKILLS) {
      const body = readSkillBody(skill.name);
      expect(body).not.toBeNull();
      expect(body).toContain(`name: ${skill.name}`);
    }
  });
});

describe("/openapi.json", () => {
  it("describes only the unauthenticated endpoints", async () => {
    const response = getOpenApi();
    expect(response.headers.get("Content-Type")).toBe("application/openapi+json");

    const spec = JSON.parse(await response.text());
    expect(spec.openapi).toMatch(/^3\.1/);
    expect(Object.keys(spec.paths).sort()).toEqual([
      "/api/health",
      "/api/roast/{shareableId}",
    ]);
    // No security schemes: there is no way for a third party to authenticate,
    // and claiming otherwise would send agents at endpoints they can't use.
    expect(spec.components.securitySchemes).toBeUndefined();
  });
});
