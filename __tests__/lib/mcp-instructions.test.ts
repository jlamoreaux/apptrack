/**
 * @jest-environment node
 */
/**
 * MCP_SERVER_INSTRUCTIONS (lib/mcp/instructions.ts). The snapshot makes any
 * text change visible in review. If this snapshot changes, bump
 * MCP_INSTRUCTIONS_VERSION in lib/constants/agent-access.ts in the same change.
 */

import { MCP_INSTRUCTIONS_VERSION } from "@/lib/constants/agent-access";
import { WIN_TAGS } from "@/lib/constants/careerotter";
import { MCP_SERVER_INSTRUCTIONS } from "@/lib/mcp/instructions";
import { VOICE_GUARDRAILS } from "@/lib/ai/voice-guardrails";

const QUOTED = /"([^"]+)"/g;

// Every quoted phrase on the guardrails' "No ..." rule lines, so the list is
// read from the source rather than copied here.
function bannedPhrases(): string[] {
  return VOICE_GUARDRAILS.split("\n")
    .filter((line) => line.startsWith("- No "))
    .flatMap((line) => Array.from(line.matchAll(QUOTED), (match) => match[1].toLowerCase()));
}

describe("MCP_SERVER_INSTRUCTIONS", () => {
  it("matches the snapshot (bump MCP_INSTRUCTIONS_VERSION when it changes)", () => {
    expect(MCP_SERVER_INSTRUCTIONS).toMatchSnapshot();
  });

  it("states its version", () => {
    expect(MCP_SERVER_INSTRUCTIONS).toContain(`version ${MCP_INSTRUCTIONS_VERSION}`);
  });

  it("uses no em or en dashes", () => {
    expect(MCP_SERVER_INSTRUCTIONS).not.toMatch(/[–—]/);
  });

  it("uses none of the banned voice phrases", () => {
    const phrases = bannedPhrases();
    expect(phrases.length).toBeGreaterThan(0);
    const text = MCP_SERVER_INSTRUCTIONS.toLowerCase();
    expect(phrases.filter((phrase) => text.includes(phrase))).toEqual([]);
  });

  it("defines every win tag", () => {
    for (const tag of WIN_TAGS) expect(MCP_SERVER_INSTRUCTIONS).toContain(`- ${tag}: `);
  });
});
