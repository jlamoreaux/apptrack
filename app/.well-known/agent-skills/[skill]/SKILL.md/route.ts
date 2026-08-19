import { AGENT_SKILLS, readSkillBody } from "@/lib/agent-discovery/skills";

/**
 * Serves an individual skill body. The name is matched against the declared
 * skill list rather than the filesystem, so an unknown segment can never reach
 * a path join.
 */

export const dynamic = "force-static";

export function generateStaticParams() {
  return AGENT_SKILLS.map((skill) => ({ skill: skill.name }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ skill: string }> },
): Promise<Response> {
  const { skill } = await params;
  const body = readSkillBody(skill);

  if (body === null) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
