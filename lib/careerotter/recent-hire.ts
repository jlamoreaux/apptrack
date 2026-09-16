/**
 * "Did this user just start a new job?" — the input to Today's "set up your new
 * role" move, which is what the product now does at the moment it used to
 * suggest cancelling.
 *
 * Read from application_history rather than applications.updated_at: the
 * handle_updated_at trigger bumps updated_at on any edit, so adding a note to a
 * months-old Hired row would read as a fresh hire and re-trigger the prompt for
 * another window. A hire with no history row (it predates the update route
 * recording transitions) doesn't fire this at all, and the user falls through to
 * "set your review date" — still the right move, just less specific.
 */

/** How long a hire stays "new" for the purpose of resetting the goal frame. */
export const RECENT_HIRE_DAYS = 45;

/**
 * A Hired transition joined to its application. PostgREST returns the embedded
 * row as an object for a to-one relationship.
 */
export interface HireTransition {
  changed_at: string | null;
  applications: {
    company: string;
    role: string;
    archived?: boolean | null;
  } | null;
}

export interface RecentHire {
  company: string;
  role: string;
}

/**
 * The most recent live Hired transition inside the window, or null.
 * `transitions` is expected newest-first, but this does not rely on that.
 */
export function findRecentHire(
  transitions: ReadonlyArray<HireTransition>,
  now: Date
): RecentHire | null {
  const cutoff = now.getTime() - RECENT_HIRE_DAYS * 86_400_000;
  let best: { hire: RecentHire; at: number } | null = null;

  for (const transition of transitions) {
    const app = transition.applications;
    if (!app || app.archived || !transition.changed_at) continue;

    const at = new Date(transition.changed_at).getTime();
    if (!Number.isFinite(at) || at < cutoff) continue;

    if (!best || at > best.at) {
      best = { hire: { company: app.company, role: app.role }, at };
    }
  }

  return best ? best.hire : null;
}
