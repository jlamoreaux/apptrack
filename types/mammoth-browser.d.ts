/**
 * Types for mammoth's prebuilt browser bundle.
 *
 * `mammoth` ships no `exports` field and no types for `mammoth.browser.js`. That bundle is
 * imported directly (rather than the package default) because the default entry resolves
 * `lib/unzip.js`, which `require`s `fs` at module load and so cannot run on Cloudflare
 * Workers. The browser bundle has no Node dependencies and accepts `{ arrayBuffer }`.
 *
 * Only the surface actually used is declared. See lib/utils/document-extraction.ts.
 */
declare module "mammoth/mammoth.browser.js" {
  interface MammothInput {
    arrayBuffer: ArrayBuffer;
  }

  interface MammothMessage {
    type: string;
    message: string;
  }

  interface MammothResult {
    value: string;
    messages: MammothMessage[];
  }

  export function extractRawText(input: MammothInput): Promise<MammothResult>;
  export function convertToHtml(input: MammothInput): Promise<MammothResult>;

  const mammoth: {
    extractRawText: typeof extractRawText;
    convertToHtml: typeof convertToHtml;
  };

  export default mammoth;
}
