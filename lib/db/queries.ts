/**
 * Drizzle implementations of the read helpers in `lib/supabase/queries.ts`.
 *
 * That module is the highest-fan-in query surface in the app — every server-rendered
 * dashboard page goes through it — which makes it the right canary for the Drizzle port and
 * the wrong thing to flip without evidence.
 *
 * Nothing calls these in production yet. `lib/db/dual-read.ts` gates each one behind
 * `DRIZZLE_MODE`, which defaults to `off`. `scripts/migration/verify-drizzle-parity.mjs`
 * runs both implementations against production data and diffs the results.
 *
 * ## Behaviour is preserved deliberately, including the parts that are wrong
 *
 * The Supabase helpers swallow every error and return `null` or `[]`. That hides outages as
 * empty states, and it should change — but as its own commit, so the error-rate delta is
 * attributable. These mirror it for now.
 *
 * ## Kept portable for D1
 *
 * No jsonb operators, no array columns, no `FOR UPDATE`. The destination is SQLite, and
 * anything Postgres-specific written here has to be rewritten twice.
 */

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./client";
import {
  applicationAiAnalyses,
  applicationHistory,
  applications,
  linkedinProfiles,
  profiles,
  subscriptionPlans,
  usageTracking,
  userSubscriptions,
} from "./schema";
import { ENTITLED_SUBSCRIPTION_STATUSES } from "@/lib/constants/subscription-status";

export async function getProfile(userId: string) {
  try {
    const [row] = await getDb()
      .select()
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export async function getSubscription(userId: string) {
  try {
    const [row] = await getDb()
      .select({
        subscription: userSubscriptions,
        subscription_plans: subscriptionPlans,
      })
      .from(userSubscriptions)
      .leftJoin(
        subscriptionPlans,
        eq(subscriptionPlans.id, userSubscriptions.planId)
      )
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          inArray(userSubscriptions.status, [...ENTITLED_SUBSCRIPTION_STATUSES])
        )
      )
      .orderBy(desc(userSubscriptions.createdAt))
      .limit(1);

    if (!row) return null;

    // Reshaped to PostgREST's embedded-select shape so callers see an identical object.
    // Drizzle returns { subscription: {...}, subscription_plans: {...} } for a join;
    // supabase-js returns the parent row with the relation nested inside it.
    return { ...row.subscription, subscription_plans: row.subscription_plans };
  } catch {
    return null;
  }
}

export async function getUsage(userId: string) {
  try {
    const [row] = await getDb()
      .select()
      .from(usageTracking)
      .where(eq(usageTracking.userId, userId))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export async function getApplications(userId: string) {
  try {
    const db = getDb();

    // Two queries rather than a join, matching the Supabase version: PostgREST cannot
    // auto-detect foreign keys on a materialized view, so the original fetched analyses
    // separately and joined in JS. Kept identical so parity is comparable; collapsing it
    // into one join is a follow-up, and the materialized view is slated for replacement by
    // a live aggregate anyway.
    const [apps, analyses] = await Promise.all([
      db
        .select()
        .from(applications)
        .where(
          and(eq(applications.userId, userId), eq(applications.archived, false))
        )
        .orderBy(desc(applications.createdAt)),
      db
        .select()
        .from(applicationAiAnalyses)
        .where(eq(applicationAiAnalyses.userId, userId)),
    ]);

    const analysesByApplication = new Map(
      analyses.map((a) => [a.applicationId, a])
    );

    return apps.map((app) => ({
      ...app,
      ai_analyses: analysesByApplication.get(app.id) ?? undefined,
    }));
  } catch {
    return [];
  }
}

export async function getArchivedApplications(userId: string) {
  try {
    return await getDb()
      .select()
      .from(applications)
      .where(
        and(eq(applications.userId, userId), eq(applications.archived, true))
      )
      .orderBy(desc(applications.updatedAt));
  } catch {
    return [];
  }
}

export async function getApplicationHistory(userId: string) {
  try {
    // `application_history` has no user_id of its own; ownership comes through the parent
    // application. The Supabase version expressed this as an embedded select
    // (`applications!inner(user_id)` filtered on `applications.user_id`) — one of only five
    // such joins in the codebase.
    //
    // Note the ordering: `changed_at` ASCENDING, unlike every other helper here. A history
    // timeline reads oldest-first.
    const rows = await getDb()
      .select({
        history: applicationHistory,
        applications: { user_id: applications.userId },
      })
      .from(applicationHistory)
      .innerJoin(
        applications,
        eq(applications.id, applicationHistory.applicationId)
      )
      .where(eq(applications.userId, userId))
      .orderBy(asc(applicationHistory.changedAt));

    // Flattened to PostgREST's shape: history columns at the top level with the joined
    // relation nested, so callers see an identical object.
    return rows.map((row) => ({ ...row.history, applications: row.applications }));
  } catch {
    return [];
  }
}

export async function getApplication(id: string, userId: string) {
  try {
    const [row] = await getDb()
      .select()
      .from(applications)
      .where(and(eq(applications.id, id), eq(applications.userId, userId)))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export async function getLinkedinProfiles(applicationId: string, userId: string) {
  try {
    return await getDb()
      .select()
      .from(linkedinProfiles)
      .where(
        and(
          eq(linkedinProfiles.applicationId, applicationId),
          eq(linkedinProfiles.userId, userId)
        )
      )
      .orderBy(desc(linkedinProfiles.createdAt));
  } catch {
    return [];
  }
}
