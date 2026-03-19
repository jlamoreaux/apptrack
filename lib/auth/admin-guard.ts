import { NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { AdminService } from '@/lib/services/admin.service';

type AdminGuardSuccess = { user: NonNullable<Awaited<ReturnType<typeof getUser>>>; error: null };
type AdminGuardFailure = { user: null; error: NextResponse };
type AdminGuardResult = AdminGuardSuccess | AdminGuardFailure;

/**
 * Shared admin authorization guard.
 *
 * Returns { user, error: null } when the request is from an authenticated admin.
 * Returns { user: null, error: NextResponse } with 401 or 403 otherwise.
 *
 * Usage:
 *   const { user, error } = await requireAdmin();
 *   if (error) return error;
 *   // proceed with admin-only logic using `user`
 */
export async function requireAdmin(): Promise<AdminGuardResult> {
  const user = await getUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const isAdmin = await AdminService.isAdmin(user.id);
  if (!isAdmin) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { user, error: null };
}
