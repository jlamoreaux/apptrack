/**
 * Stale Application Reminders (retention Phase 2b)
 *
 * Finds applications a user hasn't touched in a while and that are still
 * "awaiting a response", grouped per user for a single consolidated email.
 * Terminal states (Offer / Hired / Rejected) and archived rows are excluded —
 * Applied / Interview Scheduled / Interviewed are all still open.
 */

import { APPLICATION_STATUS } from '@/lib/constants/application-status';
import type { StaleJob } from './templates/lifecycle';
import { fetchApplicationEmailRows } from './application-rows';

export const STALE_THRESHOLD_DAYS = 5;

// Reminders only make sense while the user is still waiting to hear back.
export const TERMINAL_STATUSES: string[] = [
  APPLICATION_STATUS.OFFER,
  APPLICATION_STATUS.HIRED,
  APPLICATION_STATUS.REJECTED,
];

export interface StaleApplicationRow {
  id: string;
  user_id: string;
  company: string;
  role: string;
  status: string;
  updated_at: string;
  email: string;
  full_name: string | null;
}

export interface StaleUserGroup {
  userId: string;
  email: string;
  firstName?: string;
  jobs: StaleJob[];
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Group flat stale-application rows by user into email-ready payloads.
 * Pure function — exported for unit testing without a database.
 */
export function buildStaleGroups(rows: StaleApplicationRow[], now: Date): StaleUserGroup[] {
  const byUser = new Map<string, StaleUserGroup>();

  for (const row of rows) {
    let group = byUser.get(row.user_id);
    if (!group) {
      group = {
        userId: row.user_id,
        email: row.email,
        firstName: row.full_name?.split(' ')[0] || undefined,
        jobs: [],
      };
      byUser.set(row.user_id, group);
    }
    group.jobs.push({
      applicationId: row.id,
      company: row.company,
      role: row.role,
      status: row.status,
      daysSinceUpdate: daysBetween(new Date(row.updated_at), now),
    });
  }

  return Array.from(byUser.values());
}

/**
 * Query stale applications and return them grouped per user.
 */
export async function findStaleApplicationGroups(
  thresholdDays = STALE_THRESHOLD_DAYS,
  now = new Date()
): Promise<StaleUserGroup[]> {
  const cutoff = new Date(now.getTime() - thresholdDays * 24 * 60 * 60 * 1000).toISOString();
  const terminalList = `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(',')})`;

  const rows = await fetchApplicationEmailRows(
    (query) =>
      query.eq('archived', false).not('status', 'in', terminalList).lt('updated_at', cutoff),
    'stale_reminders_query_failed'
  );

  return buildStaleGroups(rows, now);
}
