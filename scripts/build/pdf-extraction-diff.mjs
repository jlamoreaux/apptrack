#!/usr/bin/env node
/**
 * Inspects, and optionally diffs, PDF text extraction.
 *
 * Background: `pdf-parse` was replaced by `unpdf` because pdf-parse's index.js does
 * `fs.readFileSync` at module load and cannot run on Cloudflare Workers. Extraction output
 * feeds AI prompts that are tuned on the current text, so the swap needed measuring rather
 * than assuming. Across the PDFs checked at migration time, output was identical after
 * whitespace normalisation — zero words gained or lost, differing only in a few line breaks.
 *
 * That was a small corpus of generated documents. **Run this over a sample of real user
 * resumes before trusting extraction for multi-column or table-heavy layouts**, which is
 * where PDF text extraction usually diverges.
 *
 * Usage:
 *   node scripts/build/pdf-extraction-diff.mjs resume.pdf [more.pdf ...]
 *
 * With `pdf-parse` installed (`pnpm add -D pdf-parse`) it compares the two extractors.
 * Without it, it prints what unpdf extracts so the output can be eyeballed.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/build/pdf-extraction-diff.mjs <file.pdf> [...]");
  process.exit(1);
}

/** pdf-parse is optional — it is no longer a dependency. */
async function loadLegacyExtractor() {
  try {
    // index.js readFileSyncs a sample PDF at import; the internal module skips that.
    const mod = await import("pdf-parse/lib/pdf-parse.js");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

const legacyExtractor = await loadLegacyExtractor();
const normalise = (s) => s.replace(/\s+/g, " ").trim();

for (const file of files) {
  const bytes = readFileSync(file);
  const doc = await getDocumentProxy(new Uint8Array(bytes));
  const { text: modern } = await extractText(doc, { mergePages: true });

  console.log(`\n=== ${basename(file)} ===`);

  if (!legacyExtractor) {
    console.log(`unpdf extracted ${modern.length} chars:\n`);
    console.log(modern.slice(0, 2000));
    if (modern.length > 2000) console.log(`\n… (${modern.length - 2000} more chars)`);
    continue;
  }

  const legacy = (await legacyExtractor(bytes)).text;
  const a = normalise(legacy);
  const b = normalise(modern);

  console.log(`pdf-parse: ${a.length} chars   unpdf: ${b.length} chars`);
  console.log(`identical after whitespace normalisation: ${a === b}`);

  // Word-level comparison is what matters: this is the text that reaches an LLM prompt,
  // and whitespace differences are irrelevant to it while dropped words are not.
  const wordsA = new Set(a.toLowerCase().split(" "));
  const wordsB = new Set(b.toLowerCase().split(" "));
  const lost = [...wordsA].filter((w) => !wordsB.has(w));
  const gained = [...wordsB].filter((w) => !wordsA.has(w));

  console.log(`words lost by switching to unpdf (${lost.length}): ${lost.slice(0, 15).join(", ")}`);
  console.log(`words gained (${gained.length}): ${gained.slice(0, 15).join(", ")}`);

  if (a !== b) {
    let i = 0;
    while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
    console.log(`first divergence at char ${i}:`);
    console.log(`  pdf-parse: ${JSON.stringify(a.slice(Math.max(0, i - 40), i + 60))}`);
    console.log(`  unpdf:     ${JSON.stringify(b.slice(Math.max(0, i - 40), i + 60))}`);
  }
}
