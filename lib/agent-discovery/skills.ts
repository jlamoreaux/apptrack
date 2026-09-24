import { createHash } from "node:crypto";
// Skill bodies are inlined at build time by scripts/build/gen-content.mjs — Cloudflare
// Workers has no filesystem and the bundle does not ship content/.
import { AGENT_SKILL_BODIES } from "@/lib/content/generated";

/**
 * Agent Skills published under /.well-known/agent-skills/ per the Agent Skills
 * Discovery RFC v0.2.0 (https://github.com/cloudflare/agent-skills-discovery-rfc).
 *
 * Bodies live as real markdown in content/agent-skills/<name>/SKILL.md; only the
 * index metadata lives here. The digest is derived from the exact bytes served,
 * so it can never drift from the file the way a hand-copied hash would.
 */


export const SKILLS_INDEX_SCHEMA =
  "https://schemas.agentskills.io/discovery/0.2.0/schema.json";

export interface AgentSkill {
  /** Lowercase alphanumeric + hyphens, per the RFC's name constraints. */
  name: string;
  description: string;
}

export const AGENT_SKILLS: readonly AgentSkill[] = [
  {
    name: "careerotter-free-tools",
    description:
      "Use CareerOtter's free, no-account AI tools to draft a cover letter, score a resume against a job description, or generate interview questions.",
  },
  {
    name: "careerotter-resume-roast",
    description:
      "Get blunt, specific resume feedback from CareerOtter's Resume Roast, and read a shared roast's score and categories from its permalink.",
  },
  {
    name: "careerotter-public-api",
    description:
      "Call CareerOtter's public HTTP API: service health and read access to shared Resume Roast results, including rate limits and error shapes.",
  },
] as const;

export function isKnownSkill(name: string): boolean {
  return AGENT_SKILLS.some((skill) => skill.name === name);
}

/**
 * Reads a skill body. Returns null for any name not in AGENT_SKILLS, which also
 * closes off path traversal — the allowlist is the only way into the directory.
 */
export function readSkillBody(name: string): string | null {
  if (!isKnownSkill(name)) return null;

  return AGENT_SKILL_BODIES[name] ?? null;
}

export function skillDigest(body: string): string {
  return `sha256:${createHash("sha256").update(body, "utf-8").digest("hex")}`;
}

export function skillUrl(name: string): string {
  return `/.well-known/agent-skills/${name}/SKILL.md`;
}
