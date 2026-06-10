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
import { htmlToText } from '@/lib/utils/html-to-text';
import {
  isBlockedHost,
  assertResolvesPublic,
  readBodyCapped,
} from '@/lib/utils/safe-fetch';

// Re-export the SSRF guards under this module's public API.
export { isBlockedHost, isBlockedIp } from '@/lib/utils/safe-fetch';

export interface ExtractedJob {
  company: string | null;
  title: string | null;
  location: string | null;
  posting_url: string;
  description_summary: string | null;
}

const MAX_TEXT_LENGTH = 6000;
const FETCH_TIMEOUT_MS = 10_000;
// Job postings are small; cap the body so a hostile server can't exhaust memory.
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

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
  const hostname = new URL(url).hostname;
  if (isBlockedHost(hostname)) {
    throw new Error('Blocked host');
  }
  await assertResolvesPublic(hostname);

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AppTrack/1.0)' },
    redirect: 'error', // don't follow redirects into blocked hosts
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL (HTTP ${response.status})`);
  }

  const text = htmlToText(await readBodyCapped(response, MAX_RESPONSE_BYTES)).slice(
    0,
    MAX_TEXT_LENGTH
  );
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
