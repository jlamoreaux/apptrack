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
import { getTemplatesForAudience, getTemplateById } from './templates/drip';
import { sendEmail } from './client';

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
 * - Sends Day 0 emails immediately
 * - Schedules future emails for cron processing
 */
export async function scheduleDripSequence({
  email,
  audience,
  userId,
  firstName,
  metadata = {},
}: ScheduleDripOptions): Promise<{ success: boolean; scheduled: number; sentImmediately: number }> {
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
    return { success: true, scheduled: 0, sentImmediately: 0 };
  }

  // Separate Day 0 (immediate) from future emails
  const immediateTemplates = templates.filter((t) => t.dayOffset === 0);
  const futureTemplates = templates.filter((t) => t.dayOffset > 0);

  // Calculate scheduled times for future emails
  const now = new Date();
  const emailsToSchedule = futureTemplates.map((template) => {
    const scheduledFor = new Date(now);
    scheduledFor.setDate(scheduledFor.getDate() + template.dayOffset);
    // Set to 10 AM UTC
    scheduledFor.setHours(10, 0, 0, 0);

    return {
      email: normalizedEmail,
      user_id: userId || null,
      audience,
      template_id: template.templateId,
      scheduled_for: scheduledFor.toISOString(),
      status: 'pending',
    };
  });

  // Insert future emails
  if (emailsToSchedule.length > 0) {
    const { error } = await supabase.from('drip_emails').upsert(emailsToSchedule, {
      onConflict: 'email,template_id',
      ignoreDuplicates: true,
    });

    if (error) {
      console.error('[drip-scheduler] Failed to schedule future drip emails:', error);
    }
  }

  // Send Day 0 emails immediately
  let sentImmediately = 0;
  for (const template of immediateTemplates) {
    try {
      // Check if already sent (duplicate prevention)
      const { data: existing } = await supabase
        .from('drip_emails')
        .select('id, status')
        .eq('email', normalizedEmail)
        .eq('template_id', template.templateId)
        .single();

      if (existing?.status === 'sent') {
        // Already sent, skip
        continue;
      }

      // Generate unsubscribe URL
      const unsubscribeUrl = getUnsubscribeUrl(normalizedEmail);

      // Get roast URL if available
      const roastId = metadata?.roastId;
      const roastUrl = roastId ? `${APP_URL}/roast/${roastId}` : undefined;

      // Generate email HTML
      const html = template.getHtml({
        firstName: firstName || undefined,
        email: normalizedEmail,
        unsubscribeUrl,
        roastUrl,
      });

      // Send email
      const result = await sendEmail({
        to: normalizedEmail,
        subject: template.subject,
        html,
      });

      // Record in database
      await supabase.from('drip_emails').upsert(
        {
          email: normalizedEmail,
          user_id: userId || null,
          audience,
          template_id: template.templateId,
          scheduled_for: now.toISOString(),
          status: result.success ? 'sent' : 'failed',
          sent_at: result.success ? now.toISOString() : null,
          error: result.success ? null : 'Send failed',
        },
        {
          onConflict: 'email,template_id',
        }
      );

      if (result.success) {
        sentImmediately++;
        console.log(`[drip-scheduler] Sent immediate email: ${template.templateId} to ${normalizedEmail}`);
      }
    } catch (err) {
      console.error(`[drip-scheduler] Failed to send immediate email ${template.templateId}:`, err);
    }
  }

  return {
    success: true,
    scheduled: emailsToSchedule.length,
    sentImmediately,
  };
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
 * Uses HMAC token for security (prevents forging unsubscribe links)
 */
export function getUnsubscribeUrl(email: string): string {
  // Import the token generator from unsubscribe route
  // We duplicate the logic here to avoid circular imports
  const crypto = require('crypto');
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.CRON_SECRET || 'fallback-secret-change-me';
  const normalizedEmail = email.toLowerCase().trim();
  const token = crypto
    .createHmac('sha256', secret)
    .update(normalizedEmail)
    .digest('hex');

  const encoded = encodeURIComponent(normalizedEmail);
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
