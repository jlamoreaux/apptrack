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

export const CATEGORY_COLUMN: Record<EmailCategory, keyof EmailPreferences> = {
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
 * Throws on query failure so callers can fail closed instead of treating a
 * transient error as "no row → opted in".
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
    throw new Error('Failed to fetch email preferences');
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
 * Fails closed: a preferences load error means "do not send".
 */
export async function canSendCategory(
  userId: string,
  email: string,
  category: EmailCategory
): Promise<boolean> {
  let prefs: EmailPreferences | null;
  try {
    prefs = await getEmailPreferences(userId);
  } catch {
    return false;
  }
  if (!isCategoryEnabledFor(prefs, category)) return false;
  return isUserSubscribed(email);
}

export type EmailRecipient = { userId: string; email: string };

/**
 * Batch variant of `canSendCategory` for the lifecycle crons: two queries
 * total instead of two per recipient. Returns the userIds that may receive
 * the category. Throws on query failure so the cron run aborts and retries
 * rather than silently failing open or emailing a partial set.
 */
export async function filterSendableRecipients(
  recipients: EmailRecipient[],
  category: EmailCategory
): Promise<Set<string>> {
  if (recipients.length === 0) return new Set();

  const supabase = createAdminClient();
  const userIds = recipients.map((r) => r.userId);
  const emails = recipients.map((r) => r.email.trim().toLowerCase());

  const [prefsResult, audienceResult] = await Promise.all([
    supabase
      .from('email_preferences')
      .select('user_id, drip_enabled, reminders_enabled, digest_enabled, unsubscribed_all')
      .in('user_id', userIds),
    supabase.from('audience_members').select('email, subscribed').in('email', emails),
  ]);

  if (prefsResult.error || audienceResult.error) {
    loggerService.error(
      'Failed to bulk-load email send eligibility',
      prefsResult.error ?? audienceResult.error,
      {
        category: LogCategory.EMAIL,
        action: 'email_eligibility_bulk_fetch_failed',
        metadata: { recipients: recipients.length, emailCategory: category },
      }
    );
    throw new Error('Failed to load email send eligibility');
  }

  const prefsByUser = new Map<string, EmailPreferences>();
  for (const row of prefsResult.data ?? []) {
    prefsByUser.set(row.user_id, {
      drip_enabled: row.drip_enabled,
      reminders_enabled: row.reminders_enabled,
      digest_enabled: row.digest_enabled,
      unsubscribed_all: row.unsubscribed_all,
    });
  }
  const subscribedByEmail = new Map<string, boolean>();
  for (const row of audienceResult.data ?? []) {
    subscribedByEmail.set(
      (row.email as string).trim().toLowerCase(),
      (row.subscribed as boolean) ?? true
    );
  }

  const sendable = new Set<string>();
  for (const { userId, email } of recipients) {
    const prefs = prefsByUser.get(userId) ?? null;
    if (!isCategoryEnabledFor(prefs, category)) continue;
    // No audience row → assume subscribed, matching isUserSubscribed().
    if (subscribedByEmail.get(email.trim().toLowerCase()) === false) continue;
    sendable.add(userId);
  }
  return sendable;
}
