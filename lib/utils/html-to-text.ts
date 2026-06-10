/**
 * Strip a raw HTML document down to readable text.
 *
 * Shared by the onboarding job extraction and the AI Coach
 * fetch-job-description route so both clean pages the same way.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
