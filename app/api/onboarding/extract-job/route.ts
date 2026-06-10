import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/extension-auth';
import { createRateLimiter } from '@/lib/redis/client';
import { extractJobFromUrl } from '@/lib/onboarding/job-extraction';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

// Phase 1 activation: available to ALL authenticated users (not AI-Coach gated).
// Abuse guard: 5 extractions per user per hour (PRD FR1.2).
const rateLimiter = createRateLimiter(5, '1 h');

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (rateLimiter) {
    const result = await rateLimiter.limit(`extract-job:${user.id}`);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Too many extractions. Please try again later or enter the job manually.' },
        { status: 429 }
      );
    }
  } else {
    // This rate limit is the only cost control on an LLM-backed route open to
    // all authenticated users — running without it must not pass silently.
    loggerService.warn('extract-job rate limiter unavailable; requests are unthrottled', {
      category: LogCategory.SECURITY,
      action: 'extract_job_rate_limiter_missing',
    });
  }

  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  // Only allow http(s) to avoid SSRF via file:/data: and similar schemes.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Unsupported URL scheme' }, { status: 400 });
  }

  try {
    const job = await extractJobFromUrl(url);

    loggerService.info('Onboarding job extraction succeeded', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'onboarding_extract_job_success',
      duration: Date.now() - startTime,
      metadata: { hasCompany: !!job.company, hasTitle: !!job.title },
    });

    return NextResponse.json({ job });
  } catch (error) {
    // Extraction failure is expected for unsupported boards; the client falls
    // back to manual entry, so this is a 422 rather than a 500.
    loggerService.warn('Onboarding job extraction failed; manual fallback', {
      category: LogCategory.API,
      userId: user.id,
      action: 'onboarding_extract_job_failed',
      duration: Date.now() - startTime,
      metadata: { message: error instanceof Error ? error.message : 'unknown' },
    });
    return NextResponse.json(
      { error: 'Could not extract job details. Please enter them manually.' },
      { status: 422 }
    );
  }
}
