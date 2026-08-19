import {
  AGENT_SKILLS,
  SKILLS_INDEX_SCHEMA,
  readSkillBody,
  skillDigest,
  skillUrl,
} from "@/lib/agent-discovery/skills";

/**
 * /.well-known/agent-skills/index.json — Agent Skills Discovery RFC v0.2.0.
 *
 * Digests are computed from the bytes on disk at build time (this route is
 * statically rendered), so editing a SKILL.md updates its digest automatically.
 */

export const dynamic = "force-static";

export function GET(): Response {
  const skills = AGENT_SKILLS.map((skill) => {
    const body = readSkillBody(skill.name);
    if (body === null) {
      throw new Error(`Missing SKILL.md for declared agent skill "${skill.name}"`);
    }

    return {
      name: skill.name,
      type: "skill-md",
      description: skill.description,
      url: skillUrl(skill.name),
      digest: skillDigest(body),
    };
  });

  const index = { $schema: SKILLS_INDEX_SCHEMA, skills };

  return new Response(JSON.stringify(index, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
