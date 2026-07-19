// @jest-environment node
import { findBannedConstructions, isVoiceClean } from "@/lib/ai/voice-check";
import {
  buildCoachSystemPrompt,
  COACH_STARTERS,
} from "@/lib/careerotter/coach-prompt";
import {
  COACH_EVAL_PROFILES,
  evaluateCoachOutput,
} from "@/lib/careerotter/coach-eval";

describe("voice checker", () => {
  it("flags an em dash", () => {
    expect(findBannedConstructions("You are strong — but shallow.").length).toBeGreaterThan(0);
  });
  it("flags the contrast scaffold", () => {
    expect(isVoiceClean("It's not about the wins, it's about the story.")).toBe(false);
  });
  it("flags banned filler", () => {
    expect(isVoiceClean("Let's unpack your leadership story.")).toBe(false);
  });
  it("passes clean, direct copy", () => {
    expect(isVoiceClean("Two delivery wins this quarter. Log a leadership one by Friday.")).toBe(true);
  });
});

describe("buildCoachSystemPrompt", () => {
  const wins = [{ text: "Shipped billing migration early", tag: "delivery" }];

  it("embeds the grounding rule and lists the wins", () => {
    const p = buildCoachSystemPrompt({ mode: "promotion" }, wins);
    expect(p).toMatch(/only reason from the evidence/i);
    expect(p).toContain("Shipped billing migration early");
  });

  it("states when the user has no wins", () => {
    const p = buildCoachSystemPrompt({ mode: "raise" }, []);
    expect(p).toMatch(/no wins yet/i);
  });

  it("has exactly three seeded starters", () => {
    expect(COACH_STARTERS).toHaveLength(3);
  });
});

describe("coach eval set", () => {
  it("has ten graded profiles with unique ids", () => {
    expect(COACH_EVAL_PROFILES).toHaveLength(10);
    const ids = new Set(COACH_EVAL_PROFILES.map((p) => p.id));
    expect(ids.size).toBe(10);
  });

  it("grader passes a grounded, actionable, clean reply", () => {
    const profile = COACH_EVAL_PROFILES[0]; // strong-delivery-no-leadership
    const good =
      "Your billing migration is strong delivery evidence. The gap is leadership. Take the Q3 postmortem, run it, and log it before your review.";
    expect(evaluateCoachOutput(profile, good).passed).toBe(true);
  });

  it("grader fails a reply with a banned construction", () => {
    const profile = COACH_EVAL_PROFILES[0];
    const bad =
      "Let's dive in. Your billing migration is great, take the postmortem next.";
    const res = evaluateCoachOutput(profile, bad);
    expect(res.passed).toBe(false);
    expect(res.issues.join()).toMatch(/voice/);
  });

  it("grader flags an empty-log reply that invents instead of asking", () => {
    const empty = COACH_EVAL_PROFILES.find((p) => p.id === "empty-log")!;
    const invented = "You are clearly ready. Go ask for 15%.";
    const res = evaluateCoachOutput(empty, invented);
    expect(res.passed).toBe(false);
  });
});
