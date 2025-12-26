/**
 * Drip Email Scheduler
 *
 * Handles scheduling, cancelling, and transitioning drip email sequences.
 */

import { createAdminClient } from '@/lib/supabase/admin-client';
import {
  addToAudience,
  transitionAudience as audienceTransition,
  type AudienceId,
} from './audiences';
import { getTemplatesForAudience } from './templates/drip';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://apptrack.ing';

export type ScheduleDripOptions = {
  email: string;
  audience: AudienceId;
  userId?: string;
  firstName?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Schedule a drip email sequence for a user
 * - Adds to audience (Resend + local DB)
 * - Schedules all drip emails for that audience
 */
export async function scheduleDripSequence({
  email,
  audience,
  userId,
  firstName,
  metadata = {},
}: ScheduleDripOptions): Promise<{ success: boolean; scheduled: number }> {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createAdminClient();

  // Add to audience
  await addToAudience({
    email: normalizedEmail,
    audienceId: audience,
    firstName,
    userId,
    metadata,
  });

  // Get templates for this audience
  const templates = getTemplatesForAudience(audience);

  if (templates.length === 0) {
    return { success: true, scheduled: 0 };
  }

  // Calculate scheduled times based on day offsets
  const now = new Date();
  const emailsToSchedule = templates.map((template) => {
    const scheduledFor = new Date(now);
    scheduledFor.setDate(scheduledFor.getDate() + template.dayOffset);

    // Set to 10 AM in the user's assumed timezone (UTC for now)
    // Day 0 emails are sent immediately (within next cron run)
    if (template.dayOffset > 0) {
      scheduledFor.setHours(10, 0, 0, 0);
    }

    return {
      email: normalizedEmail,
      user_id: userId || null,
      audience,
      template_id: template.templateId,
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending',
    };
  });

  // Insert drip emails, ignoring duplicates (UNIQUE constraint on email + template_id)
  const { error } = await supabase.from('drip_emails').upsert(emailsToSchedule, {
    onConflict: 'email,template_id',
    ignoreDuplicates: true,
  });

  if (error) {
    console.error('[drip-scheduler] Failed to schedule drip emails:', error);
    return { success: false, scheduled: 0 };
  }

  return { success: true, scheduled: emailsToSchedule.length };
}

/**
 * Cancel pending drip emails for a user
 * - Optionally filter by audience
 */
export async function cancelPendingDrips(
  email: string,
  audience?: AudienceId
): Promise<{ success: boolean; cancelled: number }> {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createAdminClient();

  let query = supabase
    .from('drip_emails')
    .update({ status: 'cancelled' })
    .eq('email', normalizedEmail)
    .eq('status', 'pending');

  if (audience) {
    query = query.eq('audience', audience);
  }

  const { data, error } = await query.select('id');

  if (error) {
    console.error('[drip-scheduler] Failed to cancel drip emails:', error);
    return { success: false, cancelled: 0 };
  }

  return { success: true, cancelled: data?.length || 0 };
}

/**
 * Transition a user from one audience to another
 * - Cancels pending drips from old audience
 * - Updates audience membership
 * - Schedules new drip sequence
 */
export async function transitionAudience(
  email: string,
  fromAudience: AudienceId,
  toAudience: AudienceId,
  options?: {
    userId?: string;
    firstName?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ success: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();

  // Cancel pending drips from old audience
  await cancelPendingDrips(normalizedEmail, fromAudience);

  // Transition in Resend and local DB
  await audienceTransition(normalizedEmail, fromAudience, toAudience, options);

  // Schedule new drip sequence
  await scheduleDripSequence({
    email: normalizedEmail,
    audience: toAudience,
    userId: options?.userId,
    firstName: options?.firstName,
    metadata: options?.metadata,
  });

  return { success: true };
}

/**
 * Get pending drip emails that are ready to send
 */
export async function getPendingDrips(limit = 100) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('drip_emails')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[drip-scheduler] Failed to get pending drips:', error);
    return [];
  }

  return data || [];
}

/**
 * Mark a drip email as sent
 */
export async function markDripSent(id: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('drip_emails')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('[drip-scheduler] Failed to mark drip as sent:', error);
    return false;
  }

  return true;
}

/**
 * Mark a drip email as failed
 */
export async function markDripFailed(id: string, errorMessage: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('drip_emails')
    .update({
      status: 'failed',
      error: errorMessage,
    })
    .eq('id', id);

  if (error) {
    console.error('[drip-scheduler] Failed to mark drip as failed:', error);
    return false;
  }

  return true;
}

/**
 * Generate unsubscribe URL for a user
 */
export function getUnsubscribeUrl(email: string): string {
  const encoded = encodeURIComponent(email);
  const token = Buffer.from(email).toString('base64');
  return `${APP_URL}/api/email/unsubscribe?email=${encoded}&token=${token}`;
}

/**
 * Check if a user is subscribed (for filtering before send)
 */
export async function isUserSubscribed(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('audience_members')
    .select('subscribed')
    .eq('email', normalizedEmail)
    .single();

  // If no record, assume subscribed (new user)
  return data?.subscribed ?? true;
}
