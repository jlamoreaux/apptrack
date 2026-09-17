/**
 * Evidence grounding: the deterministic net under the case-writing prompts.
 * A figure in the draft (percent, currency, multiplier) must trace back to the
 * user's input; otherwise it is caught, rewritten once, and scrubbed if it
 * survives the rewrite.
 */

// @jest-environment node

import {
  findUnsupportedFigures,
  scrubUnsupportedFigures,
  buildFigureRewriteMessage,
  generateGroundedDraft,
  MISSING_FIGURE_PLACEHOLDER,
  EVIDENCE_GROUNDING_RULES,
} from "@/lib/ai/evidence-grounding";

const INPUTS = [
  "Forward Deployed Engineer",
  "Migrated Replicate support to CSUP",
  "Consulted with Block to reduce container latency",
];

describe("findUnsupportedFigures", () => {
  it("catches percentages, currency and multipliers the input never gave", () => {
    const draft =
      "We improved reliability by 30% and cut tickets 15 percent, saving $40k, a 3x return.";
    expect(findUnsupportedFigures(draft, INPUTS)).toEqual([
      "30%",
      "15 percent",
      "$40k",
      "3x",
    ]);
  });

  it("accepts figures whose number the user did give, in any form", () => {
    const inputs = ["cut latency 30 percent", "saved about $1,200 a month", "2.5x faster"];
    const draft = "Latency fell 30%. That saved $1,200 monthly and made builds 2.5x faster.";
    expect(findUnsupportedFigures(draft, inputs)).toEqual([]);
  });

  it("does not match a number embedded in a bigger one", () => {
    // "130" in the input is not evidence for "30%".
    expect(findUnsupportedFigures("reliability up 30%", ["handled 130 tickets"])).toEqual(["30%"]);
  });

  it("leaves plain counts and years alone", () => {
    expect(findUnsupportedFigures("I shipped 3 projects in 2026.", INPUTS)).toEqual([]);
  });

  it("deduplicates repeated figures", () => {
    expect(findUnsupportedFigures("up 20%, then 20% again", INPUTS)).toEqual(["20%"]);
  });
});

describe("scrubUnsupportedFigures", () => {
  it("replaces only the unsupported figures with the placeholder", () => {
    const out = scrubUnsupportedFigures(
      "Latency fell 30% and errors fell 12%.",
      ["latency down 30 percent"]
    );
    expect(out).toBe(`Latency fell 30% and errors fell ${MISSING_FIGURE_PLACEHOLDER}.`);
  });

  it("returns the draft untouched when it is clean", () => {
    expect(scrubUnsupportedFigures("Shipped it. Nothing broke.", INPUTS)).toBe(
      "Shipped it. Nothing broke."
    );
  });
});

describe("buildFigureRewriteMessage", () => {
  it("names every invented figure and forbids substitutes", () => {
    const msg = buildFigureRewriteMessage(["30%", "$40k"]);
    expect(msg).toContain("30%, $40k");
    expect(msg).toMatch(/do not replace them with different numbers/i);
    expect(msg).toContain(MISSING_FIGURE_PLACEHOLDER);
  });
});

describe("EVIDENCE_GROUNDING_RULES", () => {
  it("tells the model a gap beats a made-up statistic", () => {
    expect(EVIDENCE_GROUNDING_RULES).toMatch(/made-up statistic is worse than a draft with a gap/);
    expect(EVIDENCE_GROUNDING_RULES).toMatch(/do not add one/);
  });
});

describe("generateGroundedDraft", () => {
  it("returns a clean first draft without a second call", async () => {
    const generate = jest.fn().mockResolvedValue("I migrated Replicate support to CSUP.");
    const r = await generateGroundedDraft(generate, INPUTS);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(r).toEqual({
      text: "I migrated Replicate support to CSUP.",
      invented: [],
      rewritten: false,
      scrubbed: false,
    });
  });

  it("asks for one rewrite, handing back the draft and the correction", async () => {
    const generate = jest
      .fn()
      .mockResolvedValueOnce("Reliability improved 30%.")
      .mockResolvedValueOnce("Reliability improved [add: by how much?].");
    const r = await generateGroundedDraft(generate, INPUTS);
    expect(generate).toHaveBeenCalledTimes(2);
    const rewrite = generate.mock.calls[1][0];
    expect(rewrite.draft).toBe("Reliability improved 30%.");
    expect(rewrite.correction).toContain("30%");
    expect(r).toMatchObject({
      text: "Reliability improved [add: by how much?].",
      invented: ["30%"],
      rewritten: true,
      scrubbed: false,
    });
  });

  it("scrubs figures that survive the rewrite instead of shipping them", async () => {
    const generate = jest
      .fn()
      .mockResolvedValueOnce("Reliability improved 30%.")
      .mockResolvedValueOnce("Reliability improved 25%.");
    const r = await generateGroundedDraft(generate, INPUTS);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(r.text).toBe(`Reliability improved ${MISSING_FIGURE_PLACEHOLDER}.`);
    expect(r.scrubbed).toBe(true);
  });
});
