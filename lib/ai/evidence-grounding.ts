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
 *    draft is matched back against the input by kind and value: "30%" needs a
 *    30 percent in the input, not a "30 tickets" or a date ending in 30, and
 *    "$40k" needs forty thousand, not "$40". Anything unsupported gets one
 *    model rewrite; anything that survives the rewrite is replaced with the
 *    same bracketed prompt the rule asks for.
 */

export const EVIDENCE_GROUNDING_VERSION = "1.1.0";

/** What the draft says in place of a number the user never gave. */
export const MISSING_FIGURE_PLACEHOLDER = "[add the number]";

export const EVIDENCE_GROUNDING_RULES = `Use only what the user has told you. Every number, percentage, dollar figure, date, name, team and outcome in the draft must come from their input. If a win has no number, keep it qualitative and do not add one: say what the win did, not how much. Where a figure would make the evidence stronger, write a short bracketed prompt in its place, like "[add: how much did latency drop?]", so the user can fill it in. A draft with a made-up statistic is worse than a draft with a gap.`;

/**
 * The kinds of figure the check understands. "amount" is a bare number with a
 * magnitude word ("40k", "1.2 million") and only ever comes from the input: a
 * user who typed "saved 40k" has given the figure behind "$40k".
 */
type FigureKind = "percent" | "currency" | "multiplier" | "amount";

interface Figure {
  kind: FigureKind;
  /** Fully expanded: "$40k" is 40000, "12.5%" is 12.5. */
  value: number;
  /** The matched text, trimmed. */
  text: string;
}

const NUM = String.raw`\d[\d,]*(?:\.\d+)?`;
const MAG_WORD = String.raw`(?:[kmb]\b|thousand|million|billion)`;
const MAG = String.raw`(?:\s?${MAG_WORD})?`;
const CURRENCY_PREFIX = String.raw`(?:US\$|USD|EUR|GBP|[$€£])\s?`;
const CURRENCY_SUFFIX = String.raw`\s?(?:dollars?|euros?|pounds?|bucks|USD|EUR|GBP)\b`;
const PERCENT_UNIT = String.raw`\s?(?:%|(?:percent|per cent|pct)\b)`;
const MULTIPLIER_UNIT = String.raw`\s?x\b`;

// Order matters: currency forms first so "$40k" is not also read as the
// amount "40k". Plain counts and years never match; "3 projects" and "2026"
// are not the failure mode, and flagging them would reject honest drafts.
const FIGURE_RE = new RegExp(
  [
    `(?<cur>${CURRENCY_PREFIX}${NUM}${MAG}|${NUM}${MAG}${CURRENCY_SUFFIX})`,
    `(?<pct>${NUM}${PERCENT_UNIT})`,
    `(?<mult>${NUM}${MULTIPLIER_UNIT})`,
    `(?<amt>${NUM}\\s?${MAG_WORD})`,
  ].join("|"),
  "gi"
);

const MAGNITUDE: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  million: 1e6,
  b: 1e9,
  billion: 1e9,
};

/** "$1,200k" -> 1200000; "12.5%" -> 12.5. */
function figureValue(text: string): number {
  const num = text.match(new RegExp(NUM));
  const base = num ? Number(num[0].replace(/,/g, "")) : NaN;
  const mag = text.match(new RegExp(`\\d\\s?(${MAG_WORD})`, "i"));
  const factor = mag ? (MAGNITUDE[mag[1].toLowerCase()] ?? 1) : 1;
  return base * factor;
}

function kindOf(groups: Record<string, string | undefined>): FigureKind {
  if (groups.cur) return "currency";
  if (groups.pct) return "percent";
  if (groups.mult) return "multiplier";
  return "amount";
}

/** Every figure in `text`, in order of appearance. */
function extractFigures(text: string): Figure[] {
  const out: Figure[] = [];
  for (const m of text.matchAll(FIGURE_RE)) {
    const t = m[0].trim();
    out.push({ kind: kindOf(m.groups ?? {}), value: figureValue(t), text: t });
  }
  return out;
}

/** Figures the user gave, across every input field. */
function inputFigures(inputs: ReadonlyArray<string | null | undefined>): Figure[] {
  return inputs
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .flatMap(extractFigures);
}

/**
 * A draft figure is supported when the input holds the same value of the same
 * kind. A bare amount in the input ("40k") also supports a currency figure in
 * the draft ("$40k"): the user gave the number, the model only added the sign.
 */
function isSupported(figure: Figure, given: ReadonlyArray<Figure>): boolean {
  return given.some(
    (g) =>
      Math.abs(g.value - figure.value) < 1e-9 &&
      (g.kind === figure.kind || (figure.kind === "currency" && g.kind === "amount"))
  );
}

/**
 * Figures in `output` (percentages, currency, multipliers) that the user never
 * gave in `inputs`. Deduplicated, in order of first appearance. Bare amounts
 * in the output ("40k" with no currency sign) are not flagged: without a unit
 * there is no claim to check.
 */
export function findUnsupportedFigures(
  output: string,
  inputs: ReadonlyArray<string | null | undefined>
): string[] {
  const given = inputFigures(inputs);
  const seen = new Set<string>();
  const unsupported: string[] = [];
  for (const f of extractFigures(output)) {
    if (f.kind === "amount" || seen.has(f.text)) continue;
    seen.add(f.text);
    if (!isSupported(f, given)) unsupported.push(f.text);
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
  const given = inputFigures(inputs);
  return output.replace(FIGURE_RE, (match, ...rest) => {
    const groups = rest[rest.length - 1] as Record<string, string | undefined>;
    const figure: Figure = { kind: kindOf(groups), value: figureValue(match.trim()), text: match.trim() };
    if (figure.kind === "amount" || isSupported(figure, given)) return match;
    return MISSING_FIGURE_PLACEHOLDER;
  });
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
