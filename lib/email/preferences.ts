/**
 * Email Preferences
 *
 * Per-category lifecycle email preferences (drip / reminders / digest).
 * `audience_members.subscribed` remains the master suppression switch; this
 * layer adds finer-grained control. A missing row means all categories are
 * enabled (opt-out model), matching the drip engine's "assume subscribed".
 */

import { createAdminClient } from '@/lib/supabase/admin-client';
import { isUserSubscribed } from './drip-scheduler';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

export type EmailCategory = 'drip' | 'reminders' | 'digest';

export type EmailPreferences = {
  drip_enabled: boolean;
  reminders_enabled: boolean;
  digest_enabled: boolean;
  unsubscribed_all: boolean;
};

export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
  drip_enabled: true,
  reminders_enabled: true,
  digest_enabled: true,
  unsubscribed_all: false,
};

const CATEGORY_COLUMN: Record<EmailCategory, keyof EmailPreferences> = {
  drip: 'drip_enabled',
  reminders: 'reminders_enabled',
  digest: 'digest_enabled',
};

/**
 * Resolve a category preference from a (possibly absent) preferences row.
 * Pure helper — exported for direct unit testing without a database.
 */
export function isCategoryEnabledFor(
  prefs: EmailPreferences | null,
  category: EmailCategory
): boolean {
  if (!prefs) return true; // no row → opted in by default
  if (prefs.unsubscribed_all) return false;
  return prefs[CATEGORY_COLUMN[category]];
}

/**
 * Fetch a user's preferences, or null if no row exists yet.
 */
export async function getEmailPreferences(
  userId: string
): Promise<EmailPreferences | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('email_preferences')
    .select('drip_enabled, reminders_enabled, digest_enabled, unsubscribed_all')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    loggerService.error('Failed to fetch email preferences', error, {
      category: LogCategory.EMAIL,
      action: 'email_preferences_fetch_failed',
      metadata: { userId },
    });
    return null;
  }

  return data as EmailPreferences | null;
}

/**
 * Upsert a user's preferences.
 */
export async function updateEmailPreferences(
  userId: string,
  updates: Partial<EmailPreferences>
): Promise<{ success: boolean }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('email_preferences').upsert(
    {
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    loggerService.error('Failed to update email preferences', error, {
      category: LogCategory.EMAIL,
      action: 'email_preferences_update_failed',
      metadata: { userId },
    });
    return { success: false };
  }

  return { success: true };
}

/**
 * Whether a lifecycle email of the given category may be sent to this user.
 * Honors both the per-category preference and the master audience suppression.
 */
export async function canSendCategory(
  userId: string,
  email: string,
  category: EmailCategory
): Promise<boolean> {
  const prefs = await getEmailPreferences(userId);
  if (!isCategoryEnabledFor(prefs, category)) return false;
  return isUserSubscribed(email);
}
