import { NextRequest, NextResponse } from 'next/server';
import { validateEmail } from '@/lib/email/validate';
import { scheduleDripSequence } from '@/lib/email/drip-scheduler';

// Simple in-memory rate limiting: max 5 submissions per IP per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count++;
  return false;
}

// Periodically clean up expired entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, source, sessionId, firstName } = body as {
      email: string;
      source: string;
      sessionId?: string;
      firstName?: string;
    };

    // Validate required fields
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!source) {
      return NextResponse.json(
        { error: 'Source is required' },
        { status: 400 }
      );
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return NextResponse.json(
        { error: emailValidation.message || 'Invalid email address' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Schedule drip sequence (adds to audience + sends Day 0 emails)
    await scheduleDripSequence({
      email: normalizedEmail,
      audience: 'leads',
      firstName: firstName || undefined,
      metadata: {
        source: `try-${source}`,
        sessionId: sessionId || undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[capture-email] Failed to capture email:', error);
    return NextResponse.json(
      { error: 'Failed to capture email. Please try again.' },
      { status: 500 }
    );
  }
}
