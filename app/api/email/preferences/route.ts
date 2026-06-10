import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getEmailPreferences,
  updateEmailPreferences,
  DEFAULT_EMAIL_PREFERENCES,
  type EmailPreferences,
} from '@/lib/email/preferences';
import { unsubscribeContact, resubscribeContact } from '@/lib/email/audiences';
import { cancelPendingDrips, isUserSubscribed } from '@/lib/email/drip-scheduler';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

const BOOLEAN_KEYS: (keyof EmailPreferences)[] = [
  'drip_enabled',
  'reminders_enabled',
  'digest_enabled',
  'unsubscribed_all',
];

async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * `audience_members.subscribed` is the master suppression switch (CAN-SPAM),
 * so reads must reflect it and writes to `unsubscribed_all` must update it —
 * otherwise a user who unsubscribed via an email link would see
 * `unsubscribed_all: false` here, and opting out here wouldn't stop sends.
 */
async function loadPreferences(userId: string, email: string): Promise<EmailPreferences> {
  const prefs = (await getEmailPreferences(userId)) ?? DEFAULT_EMAIL_PREFERENCES;
  const subscribed = await isUserSubscribed(email);
  return { ...prefs, unsubscribed_all: prefs.unsubscribed_all || !subscribed };
}

export async function GET() {
  const user = await getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const prefs = await loadPreferences(user.id, user.email);
    return NextResponse.json({ preferences: prefs });
  } catch {
    return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Whitelist boolean fields only.
  const updates: Partial<EmailPreferences> = {};
  for (const key of BOOLEAN_KEYS) {
    if (typeof body[key] === 'boolean') {
      updates[key] = body[key] as boolean;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid preference fields provided' }, { status: 400 });
  }

  const result = await updateEmailPreferences(user.id, updates);
  if (!result.success) {
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }

  // Keep the audience master switch in sync with the global flag.
  if (updates.unsubscribed_all === true) {
    await unsubscribeContact(user.email);
    await cancelPendingDrips(user.email);
  } else if (updates.unsubscribed_all === false) {
    await resubscribeContact(user.email);
  }

  loggerService.info('Email preferences updated', {
    category: LogCategory.BUSINESS,
    userId: user.id,
    action: 'email_preferences_updated',
    metadata: { fields: Object.keys(updates) },
  });

  try {
    const prefs = await loadPreferences(user.id, user.email);
    return NextResponse.json({ preferences: prefs });
  } catch {
    // The update succeeded; only the re-read failed.
    return NextResponse.json({ preferences: { ...DEFAULT_EMAIL_PREFERENCES, ...updates } });
  }
}
