import { NextRequest, NextResponse } from 'next/server';
import { validateEmail } from '@/lib/email/validate';
import { scheduleDripSequence } from '@/lib/email/drip-scheduler';
import { sendTryResultsEmail } from '@/lib/email/transactional';
import { createServiceRoleClient } from '@/lib/supabase/service-role-client';
import { decryptContent } from '@/lib/utils/encryption';

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

    // Schedule drip sequence (adds to audience + schedules Day 2/5 emails)
    await scheduleDripSequence({
      email: normalizedEmail,
      audience: 'leads',
      firstName: firstName || undefined,
      metadata: {
        source: `try-${source}`,
        sessionId: sessionId || undefined,
      },
    });

    // Send transactional email with actual results (non-blocking)
    if (sessionId) {
      sendResultsEmail(normalizedEmail, sessionId, firstName).catch((err) => {
        console.error('[capture-email] Failed to send results email:', err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[capture-email] Failed to capture email:', error);
    return NextResponse.json(
      { error: 'Failed to capture email. Please try again.' },
      { status: 500 }
    );
  }
}

/** Decrypt session results and send transactional email with actual content */
async function sendResultsEmail(email: string, sessionId: string, firstName?: string) {
  const serviceClient = createServiceRoleClient();

  const { data: session, error } = await serviceClient
    .from('ai_preview_sessions')
    .select('feature_type, full_content_encrypted')
    .eq('id', sessionId)
    .single();

  if (error) {
    console.error('[capture-email] Failed to fetch session:', error.message);
    return;
  }

  if (!session?.full_content_encrypted) return;

  const decryptedString = decryptContent(session.full_content_encrypted);
  let fullContent;
  try {
    fullContent = JSON.parse(decryptedString);
  } catch (parseError) {
    console.error('[capture-email] Failed to parse decrypted content:', parseError);
    return;
  }

  await sendTryResultsEmail({
    email,
    firstName,
    featureType: session.feature_type,
    results: fullContent,
  });
}
