/**
 * Evidence grounding for the case-writing prompts (Zero to Case, case builder).
 *
 * Asked for "measurable results", a model whose input carries no numbers will
 * supply its own ("improved reliability by 30%"). Two layers stop that reaching
 * the user's document:
 *
 * 1. A prompt rule shared by every prompt that writes in the user's voice: every
 *    figure must come from their input, and a missing number is written as a
 *    bracketed prompt for the user to fill in, never invented.
 * 2. A deterministic check on the output. Percentages, currency amounts and
 *    multipliers are the shapes a fabricated stat takes, so each one in the
 *    draft is matched back against the input. Anything unsupported gets one
 *    model rewrite; anything that survives the rewrite is replaced with the
 *    same bracketed prompt the rule asks for.
 */

export const EVIDENCE_GROUNDING_VERSION = "1.0.0";

/** What the draft says in place of a number the user never gave. */
export const MISSING_FIGURE_PLACEHOLDER = "[add the number]";

export const EVIDENCE_GROUNDING_RULES = `Use only what the user has told you. Every number, percentage, dollar figure, date, name, team and outcome in the draft must come from their input. If a win has no number, keep it qualitative and do not add one: say what the win did, not how much. Where a figure would make the evidence stronger, write a short bracketed prompt in its place, like "[add: how much did latency drop?]", so the user can fill it in. A draft with a made-up statistic is worse than a draft with a gap.`;

// The figure shapes a fabricated stat takes: "30%", "12.5 percent", "$40k",
// "$1.2 million", "3x". Plain counts and years are left alone: "3 projects" or
// "2026" are not the failure mode, and flagging them would reject honest drafts.
const FIGURE_RE =
  /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:[kmb]\b|million|billion|thousand)?|\d[\d,]*(?:\.\d+)?\s?(?:%|percent\b|per cent\b|x\b)/gi;

/** The bare numeric value inside a figure: "$1,200k" -> "1200", "12.5%" -> "12.5". */
function numericCore(figure: string): string {
  const m = figure.match(/\d[\d,]*(?:\.\d+)?/);
  return (m ? m[0] : figure).replace(/,/g, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when the input mentions this exact number as a standalone value. */
function inputHasNumber(inputText: string, core: string): boolean {
  const re = new RegExp(`(?<![\\d.])${escapeRegExp(core)}(?![\\d.])`);
  return re.test(inputText);
}

function joinInputs(inputs: ReadonlyArray<string | null | undefined>): string {
  return inputs
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join("\n")
    .replace(/,(?=\d{3}\b)/g, "");
}

/**
 * Figures in `output` (percentages, currency, multipliers) whose number does not
 * appear anywhere in `inputs`. Deduplicated, in order of first appearance.
 */
export function findUnsupportedFigures(
  output: string,
  inputs: ReadonlyArray<string | null | undefined>
): string[] {
  const inputText = joinInputs(inputs);
  const seen = new Set<string>();
  const unsupported: string[] = [];
  for (const m of output.matchAll(FIGURE_RE)) {
    const figure = m[0].trim();
    if (seen.has(figure)) continue;
    seen.add(figure);
    if (!inputHasNumber(inputText, numericCore(figure))) unsupported.push(figure);
  }
  return unsupported;
}

/**
 * Replace every unsupported figure in `output` with the placeholder, so a
 * sentence like "cut latency by 20%" becomes "cut latency by [add the number]".
 * The last resort after a rewrite still carries invented figures.
 */
export function scrubUnsupportedFigures(
  output: string,
  inputs: ReadonlyArray<string | null | undefined>
): string {
  const unsupported = findUnsupportedFigures(output, inputs);
  if (unsupported.length === 0) return output;
  const inputText = joinInputs(inputs);
  return output.replace(FIGURE_RE, (figure) =>
    inputHasNumber(inputText, numericCore(figure.trim()))
      ? figure
      : MISSING_FIGURE_PLACEHOLDER
  );
}

/** The follow-up turn that asks the model to remove figures it made up. */
export function buildFigureRewriteMessage(figures: ReadonlyArray<string>): string {
  return [
    `Your draft includes figures the user never gave you: ${figures.join(", ")}.`,
    "Remove every one of them. Do not replace them with different numbers, and do not add any figure that is not in the user's input.",
    `Rewrite the full draft, keeping everything else the same. Where a number would strengthen a point, leave a bracketed prompt for the user instead, like "${MISSING_FIGURE_PLACEHOLDER}".`,
  ].join(" ");
}

export interface GroundedDraft {
  text: string;
  /** Figures the first draft invented (empty when it was clean). */
  invented: string[];
  /** Whether a rewrite was requested. */
  rewritten: boolean;
  /** Whether figures had to be scrubbed after the rewrite. */
  scrubbed: boolean;
}

/**
 * Generate a draft, check it for invented figures, and repair it: one rewrite
 * turn, then a deterministic scrub of whatever the rewrite still contains.
 *
 * `generate` is called once with no argument for the first draft, and once more
 * with the draft and the correction if a rewrite is needed. The caller decides
 * how to fold those into its own message shape.
 */
export async function generateGroundedDraft(
  generate: (rewrite?: { draft: string; correction: string }) => Promise<string>,
  inputs: ReadonlyArray<string | null | undefined>
): Promise<GroundedDraft> {
  const first = await generate();
  const invented = findUnsupportedFigures(first, inputs);
  if (invented.length === 0) {
    return { text: first, invented, rewritten: false, scrubbed: false };
  }

  const second = await generate({
    draft: first,
    correction: buildFigureRewriteMessage(invented),
  });
  const remaining = findUnsupportedFigures(second, inputs);
  if (remaining.length === 0) {
    return { text: second, invented, rewritten: true, scrubbed: false };
  }

  return {
    text: scrubUnsupportedFigures(second, inputs),
    invented,
    rewritten: true,
    scrubbed: true,
  };
}
