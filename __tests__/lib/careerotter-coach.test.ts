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

  it("grader accepts a reply that rephrases a win's opening verb", () => {
    const profile = COACH_EVAL_PROFILES.find((p) => p.id === "no-review-date")!;
    const reply = "Your 20% infra saving is your best evidence. Ask now and bring that number.";
    expect(evaluateCoachOutput(profile, reply).passed).toBe(true);
  });

  it("grader fails a reply that cites none of the logged wins", () => {
    const profile = COACH_EVAL_PROFILES.find((p) => p.id === "no-review-date")!;
    const res = evaluateCoachOutput(profile, "Ask now and bring your manager a clear number.");
    expect(res.issues).toContain("does not reference a logged win");
  });

  it("grader does not count a generic word shared with a win as citing it", () => {
    const profile = COACH_EVAL_PROFILES.find((p) => p.id === "balanced-case")!;
    const res = evaluateCoachOutput(profile, "Before your review, ask for feedback.");
    expect(res.issues).toContain("does not reference a logged win");
  });

  it("grader counts a win's metric as citing it", () => {
    const profile = COACH_EVAL_PROFILES.find((p) => p.id === "strong-delivery-no-leadership")!;
    const reply = "Your p95 dropped from 4d to 26h. Ask your manager to highlight that result.";
    expect(evaluateCoachOutput(profile, reply).passed).toBe(true);
  });

  it("grader does not count a bare number or a longer token containing a metric", () => {
    const profile = COACH_EVAL_PROFILES.find((p) => p.id === "strong-delivery-no-leadership")!;
    const res = evaluateCoachOutput(profile, "Ask for 26 minutes and bring 14d of notes.");
    expect(res.issues).toContain("does not reference a logged win");
  });

  it("grader does not count a quarter label as citing a win", () => {
    const profile = COACH_EVAL_PROFILES.find((p) => p.id === "balanced-case")!;
    const res = evaluateCoachOutput(profile, "Ask your manager about Q2.");
    expect(res.issues).toContain("does not reference a logged win");
  });

  it("dated profiles describe a review that is still ahead", () => {
    const today = new Date().toISOString().slice(0, 10);
    const dated = COACH_EVAL_PROFILES.flatMap((p) => p.profile.review_date ?? []);
    expect(dated.length).toBeGreaterThan(0);
    for (const date of dated) expect(date > today).toBe(true);
  });

  it("grader flags an empty-log reply that invents instead of asking", () => {
    const empty = COACH_EVAL_PROFILES.find((p) => p.id === "empty-log")!;
    const invented = "You are clearly ready. Go ask for 15%.";
    const res = evaluateCoachOutput(empty, invented);
    expect(res.passed).toBe(false);
  });
});
