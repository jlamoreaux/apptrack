/**
 * Guided First-Job Import — URL extraction (retention Phase 1)
 *
 * Fetches a job-posting URL and uses an LLM to extract structured fields the
 * onboarding form can pre-fill. Unlike `app/api/ai-coach/fetch-job-description`
 * (which is paywalled and returns raw text), this is available to every new
 * user and returns typed JSON.
 */

import { callOpenAI } from '@/lib/openai/client';
import { Models } from '@/lib/openai/models';

export interface ExtractedJob {
  company: string | null;
  title: string | null;
  location: string | null;
  posting_url: string;
  description_summary: string | null;
}

const MAX_TEXT_LENGTH = 6000;

/**
 * Reject hosts that could be used for SSRF (loopback, private ranges, link-local
 * cloud metadata). This route is authenticated but not paywalled, so it must not
 * become a proxy for reaching internal services.
 */
export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return true;
  }
  // IPv6 loopback / unspecified
  if (host === '::1' || host === '[::1]' || host === '::' ) return true;
  // Cloud metadata + private/loopback/link-local IPv4 ranges
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

/**
 * Strip a raw HTML document down to readable text. Mirrors the cleaning used in
 * the existing fetch-job-description route so behavior is consistent.
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

/**
 * Parse the model's JSON response into a validated ExtractedJob.
 * Tolerates code fences and stray prose around the JSON object.
 * Pure function — exported for unit testing without network/LLM calls.
 */
export function parseExtractionResponse(raw: string, postingUrl: string): ExtractedJob {
  const fallback: ExtractedJob = {
    company: null,
    title: null,
    location: null,
    posting_url: postingUrl,
    description_summary: null,
  };

  // Pull the first {...} block so we ignore fences/preamble the model may add.
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    return fallback;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return fallback;
  }

  const str = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const trimmed = v.trim();
    // Models sometimes emit these sentinels instead of real nulls.
    if (!trimmed || /^(null|n\/a|unknown|not specified)$/i.test(trimmed)) return null;
    return trimmed;
  };

  return {
    company: str(parsed.company),
    title: str(parsed.title),
    location: str(parsed.location),
    posting_url: postingUrl,
    description_summary: str(parsed.description_summary),
  };
}

const SYSTEM_PROMPT =
  'You extract structured data from job postings. Respond with ONLY a JSON object ' +
  'with keys: company, title, location, description_summary. Use null for any field ' +
  'you cannot determine. Keep description_summary to 2-3 sentences. Do not invent values.';

/**
 * Fetch a job-posting URL and extract structured fields via the cost model.
 * Throws on fetch failure so the caller can fall back to manual entry.
 */
export async function extractJobFromUrl(url: string): Promise<ExtractedJob> {
  if (isBlockedHost(new URL(url).hostname)) {
    throw new Error('Blocked host');
  }

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AppTrack/1.0)' },
    redirect: 'error', // don't follow redirects into blocked hosts
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (HTTP ${response.status})`);
  }

  const text = htmlToText(await response.text()).slice(0, MAX_TEXT_LENGTH);
  if (!text) {
    throw new Error('No readable content at URL');
  }

  const raw = await callOpenAI({
    model: Models.default,
    temperature: 0,
    maxTokens: 500,
    systemPrompt: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Extract the job details from this posting:\n\n${text}`,
      },
    ],
  });

  return parseExtractionResponse(raw, url);
}
