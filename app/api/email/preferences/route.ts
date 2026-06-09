import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getEmailPreferences,
  updateEmailPreferences,
  DEFAULT_EMAIL_PREFERENCES,
  type EmailPreferences,
} from '@/lib/email/preferences';
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

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prefs = (await getEmailPreferences(user.id)) ?? DEFAULT_EMAIL_PREFERENCES;
  return NextResponse.json({ preferences: prefs });
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) {
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

  loggerService.info('Email preferences updated', {
    category: LogCategory.BUSINESS,
    userId: user.id,
    action: 'email_preferences_updated',
    metadata: { fields: Object.keys(updates) },
  });

  const prefs = (await getEmailPreferences(user.id)) ?? DEFAULT_EMAIL_PREFERENCES;
  return NextResponse.json({ preferences: prefs });
}
