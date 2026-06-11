import { type NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/extension-auth';
import { createRateLimiter } from '@/lib/redis/client';
import { generateOnboardingInsight } from '@/lib/ai-coach/onboarding-insight';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

// Phase 3 anchor: available to ALL authenticated users, does not touch trial
// budget. Light rate limit to bound cost from repeated calls.
const rateLimiter = createRateLimiter(10, '1 h');

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (rateLimiter) {
    const result = await rateLimiter.limit(`coach-insight:${user.id}`);
    if (!result.success) {
      return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
    }
  }

  let body: { company?: unknown; role?: unknown; jobDescription?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { company, role, jobDescription } = body;
  if (typeof company !== 'string' || !company.trim() || typeof role !== 'string' || !role.trim()) {
    return NextResponse.json({ error: 'company and role are required' }, { status: 400 });
  }

  try {
    const insight = await generateOnboardingInsight({
      company,
      role,
      jobDescription: typeof jobDescription === 'string' ? jobDescription : undefined,
    });

    loggerService.info('Onboarding coach insight generated', {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: 'onboarding_coach_insight_success',
      duration: Date.now() - startTime,
    });

    return NextResponse.json({ insight });
  } catch (error) {
    loggerService.error('Onboarding coach insight failed', error, {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: 'onboarding_coach_insight_error',
      duration: Date.now() - startTime,
    });
    return NextResponse.json({ error: 'Could not generate insight right now.' }, { status: 500 });
  }
}
