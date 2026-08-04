/**
 * Voice checker — detects the banned constructions from the brand guide §3.2 in
 * generated text. Used by the coach eval set (M3) and available for any model
 * output review. Heuristic, not exhaustive: catches the loud, common tells.
 */

const BANNED_PHRASES = [
  "let's dive in",
  "let's unpack",
  "deep dive",
  "unlock",
  "supercharge",
  "elevate",
  "empower",
  "leverage",
  "streamline",
  "seamless",
  "robust",
  "holistic",
  "navigate",
  "delve",
  "realm",
  "tapestry",
  "landscape",
  "in today's world",
  "it's worth noting",
  "it's important to remember",
  "keep in mind that",
  "at the end of the day",
  "great question",
  "you're absolutely right",
  "spot on",
  "as an ai",
  "i'm just an ai",
];

// "not X, it's Y" / "not just X, but Y" / "isn't about X, it's about Y".
const CONTRAST_SCAFFOLD =
  /\b(it'?s not|not just|isn'?t about|it isn'?t)\b[^.?!]{1,60}?,?\s+(it'?s|but|it'?s about)\b/i;

export interface VoiceViolation {
  rule: string;
  match: string;
}

export function findBannedConstructions(text: string): VoiceViolation[] {
  const violations: VoiceViolation[] = [];
  const lower = text.toLowerCase();

  // Em dash (— or the double-hyphen stand-in).
  if (/—/.test(text) || /\s--\s/.test(text)) {
    violations.push({ rule: "em-dash", match: "—" });
  }

  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      violations.push({ rule: "banned-phrase", match: phrase });
    }
  }

  const scaffold = text.match(CONTRAST_SCAFFOLD);
  if (scaffold) {
    violations.push({ rule: "contrast-scaffold", match: scaffold[0] });
  }

  return violations;
}

export function isVoiceClean(text: string): boolean {
  return findBannedConstructions(text).length === 0;
}
