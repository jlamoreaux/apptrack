/**
 * Paginated application-row fetcher for lifecycle email crons.
 *
 * Both the stale-reminder and weekly-digest crons need every matching
 * application joined to the owner's email. A single `.select()` is capped by
 * PostgREST's default max rows, so we page through with `.range()` and flatten
 * the joined profile. Rows without a resolvable email are dropped.
 */

import { createAdminClient } from '@/lib/supabase/admin-client';
import { loggerService } from '@/lib/services/logger.service';
import { LogCategory } from '@/lib/services/logger.types';

export interface RawApplicationEmailRow {
  id: string;
  user_id: string;
  company: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
  email: string;
  full_name: string | null;
}

const SELECT =
  'id, user_id, company, role, status, created_at, updated_at, profiles!inner(email, full_name)';
const PAGE_SIZE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryBuilder = any;
export type QueryFilter = (query: QueryBuilder) => QueryBuilder;

export async function fetchApplicationEmailRows(
  applyFilters: QueryFilter,
  failureAction: string
): Promise<RawApplicationEmailRow[]> {
  const supabase = createAdminClient();
  const rows: RawApplicationEmailRow[] = [];
  let from = 0;

  for (;;) {
    const query = applyFilters(supabase.from('applications').select(SELECT)).range(
      from,
      from + PAGE_SIZE - 1
    );
    const { data, error } = await query;

    if (error) {
      loggerService.error('Failed to fetch application rows for lifecycle email', error, {
        category: LogCategory.EMAIL,
        action: failureAction,
      });
      break;
    }

    const batch = (data ?? []) as Record<string, unknown>[];
    for (const r of batch) {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      const email = (profile?.email as string) ?? '';
      if (!email) continue;
      rows.push({
        id: r.id as string,
        user_id: r.user_id as string,
        company: r.company as string,
        role: r.role as string,
        status: r.status as string,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
        email,
        full_name: (profile?.full_name as string | null) ?? null,
      });
    }

    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}
