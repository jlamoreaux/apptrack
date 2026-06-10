/**
 * Shared plumbing for the lifecycle email crons (stale reminders, weekly
 * digest): timing-safe cron auth and a batched send loop with one bulk
 * eligibility check and bounded concurrency, so runs stay inside the route's
 * execution window as the user base grows.
 */

import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { sendEmail } from './client';
import { filterSendableRecipients, type EmailCategory } from './preferences';
import { loggerService } from '@/lib/services/logger.service';

const SEND_CONCURRENCY = 5;

/**
 * Validate the cron Authorization header against CRON_SECRET using a
 * constant-time comparison. Fails closed when the secret is unset.
 */
export function verifyCronAuth(request: NextRequest, endpoint: string): boolean {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  let authorized = false;

  if (secret && authHeader) {
    const expected = Buffer.from(`Bearer ${secret}`);
    const provided = Buffer.from(authHeader);
    authorized = expected.length === provided.length && timingSafeEqual(expected, provided);
  }

  if (!authorized) {
    loggerService.logSecurityEvent(
      'cron_unauthorized_access',
      'high',
      { endpoint, providedAuth: authHeader ? 'present' : 'missing' },
      {}
    );
  }
  return authorized;
}

export interface LifecycleSendCounters {
  sent: number;
  skipped: number;
  failed: number;
}

export interface LifecycleEmailGroup {
  userId: string;
  email: string;
}

export interface RunLifecycleSendOptions<G extends LifecycleEmailGroup> {
  groups: G[];
  category: EmailCategory;
  /** Build the message for one group; may be async (e.g. LLM insight). */
  buildEmail: (group: G) => Promise<{ subject: string; html: string }> | { subject: string; html: string };
  /** Called after a successful send, for analytics. */
  onSent?: (group: G) => void;
  /** Called when sending one group throws, for logging. */
  onError: (group: G, error: unknown) => void;
}

/**
 * Send one lifecycle email per group. Eligibility (per-category preference +
 * master audience suppression) is resolved in a single bulk check, then sends
 * run in chunks of SEND_CONCURRENCY. Per-group failures are counted, not
 * thrown; bulk-eligibility failure throws so the run aborts and retries.
 */
export async function runLifecycleSend<G extends LifecycleEmailGroup>(
  options: RunLifecycleSendOptions<G>
): Promise<LifecycleSendCounters> {
  const { groups, category, buildEmail, onSent, onError } = options;
  const counters: LifecycleSendCounters = { sent: 0, skipped: 0, failed: 0 };

  const sendable = await filterSendableRecipients(
    groups.map((g) => ({ userId: g.userId, email: g.email })),
    category
  );

  const eligible: G[] = [];
  for (const group of groups) {
    if (sendable.has(group.userId)) {
      eligible.push(group);
    } else {
      counters.skipped++;
    }
  }

  for (let i = 0; i < eligible.length; i += SEND_CONCURRENCY) {
    const chunk = eligible.slice(i, i + SEND_CONCURRENCY);
    await Promise.all(
      chunk.map(async (group) => {
        try {
          const { subject, html } = await buildEmail(group);
          const result = await sendEmail({ to: group.email, subject, html });
          if (result.success) {
            counters.sent++;
            onSent?.(group);
          } else {
            counters.failed++;
          }
        } catch (error) {
          counters.failed++;
          onError(group, error);
        }
      })
    );
  }

  return counters;
}
