/**
 * Workers-safe text extraction for uploaded documents.
 *
 * Both previous libraries read the filesystem at module load, which cannot work on
 * Cloudflare Workers:
 *
 *   - `pdf-parse`'s `index.js` does `fs.readFileSync("./test/data/05-versions-space.pdf")`
 *     at import time — leftover debug code that throws the moment the module is loaded
 *     outside its own repo. Replaced with `unpdf`, a serverless-targeted PDF.js build.
 *   - `mammoth`'s default entry point resolves `lib/unzip.js`, which `require`s `fs` and
 *     only accepts `{path}` or `{buffer}`. Its prebuilt browser bundle has no `fs` and
 *     accepts `{arrayBuffer}`, so that is what is imported here — explicitly, rather than
 *     relying on a bundler to honour the `browser` field.
 *
 * Extraction fidelity was measured, not assumed: `scripts/build/pdf-extraction-diff.mjs`
 * compares both extractors over real PDFs. Across the documents checked, output was
 * identical after whitespace normalisation with zero words gained or lost — the only
 * difference was a handful of line breaks. **Re-run that harness against a sample of real
 * user resumes before trusting this for multi-column or table-heavy layouts**, which is
 * where PDF text extraction usually diverges.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires -- see module docblock
import mammothBrowser from "mammoth/mammoth.browser.js";

/** Normalises the several byte containers callers hold into the one both libraries take. */
function toUint8Array(input: Buffer | ArrayBuffer | Uint8Array): Uint8Array {
  if (input instanceof Uint8Array) return input;
  return new Uint8Array(input);
}

/** Extracts plain text from a PDF. Returns "" when the document has no text layer. */
export async function extractPdfText(
  input: Buffer | ArrayBuffer | Uint8Array
): Promise<string> {
  // Imported lazily so the PDF.js bundle is not pulled into routes that never parse a PDF.
  const { extractText, getDocumentProxy } = await import("unpdf");

  const document = await getDocumentProxy(toUint8Array(input));
  const { text } = await extractText(document, { mergePages: true });
  return text;
}

/** Extracts plain text from a .docx. */
export async function extractDocxText(
  input: Buffer | ArrayBuffer | Uint8Array
): Promise<string> {
  const bytes = toUint8Array(input);
  // Copy into a standalone ArrayBuffer: a Uint8Array view may be a window onto a larger
  // pooled buffer (Node does this routinely), and handing that whole buffer to the unzip
  // reader would surface adjacent bytes as document content.
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;

  const result = await mammothBrowser.extractRawText({ arrayBuffer });
  return result.value;
}
