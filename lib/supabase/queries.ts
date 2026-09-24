import { dualRead } from "@/lib/db/dual-read";
import { createClient } from "./server-client";
import { redirect } from "next/navigation";

export async function getUser() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
}

export async function requireAuth() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

async function getProfileViaSupabase(userId: string) {
  try {
    const supabase = await createClient();

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      return null;
    }

    return profile;
  } catch (error) {
    return null;
  }
}

async function getSubscriptionViaSupabase(userId: string) {
  try {
    const supabase = await createClient();

    const { data: subscription, error } = await supabase
      .from("user_subscriptions")
      .select(
        `
        *,
        subscription_plans (*)
      `
      )
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      return null;
    }

    return subscription;
  } catch (error) {
    return null;
  }
}

async function getUsageViaSupabase(userId: string) {
  try {
    const supabase = await createClient();

    const { data: usage, error } = await supabase
      .from("usage_tracking")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") {
      return null;
    }

    return usage;
  } catch (error) {
    return null;
  }
}

async function getApplicationsViaSupabase(userId: string) {
  try {
    const supabase = await createClient();

    // Fetch applications and AI analyses separately since PostgREST
    // can't auto-detect FK relationships on materialized views
    const [appsResult, analysesResult] = await Promise.all([
      supabase
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("application_ai_analyses")
        .select("*")
        .eq("user_id", userId),
    ]);

    if (appsResult.error) {
      return [];
    }

    const applications = appsResult.data || [];

    // Build a lookup map for analyses by application_id
    const analysesMap = new Map(
      (analysesResult.data || []).map((a: any) => [a.application_id, a])
    );

    return applications.map((app: any) => ({
      ...app,
      ai_analyses: analysesMap.get(app.id) || undefined,
    }));
  } catch (error) {
    return [];
  }
}

async function getArchivedApplicationsViaSupabase(userId: string) {
  try {
    const supabase = await createClient();

    const { data: applications, error } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", true) // Only get archived applications
      .order("updated_at", { ascending: false });

    if (error) {
      return [];
    }

    return applications || [];
  } catch (error) {
    return [];
  }
}

async function getApplicationHistoryViaSupabase(userId: string) {
  try {
    const supabase = await createClient();

    // Get history for applications belonging to this user
    const { data: history, error } = await supabase
      .from("application_history")
      .select(
        `
        *,
        applications!inner(user_id)
      `
      )
      .eq("applications.user_id", userId)
      .order("changed_at", { ascending: true });

    if (error) {
      return [];
    }

    return history || [];
  } catch (error) {
    return [];
  }
}

async function getApplicationViaSupabase(id: string, userId: string) {
  try {
    const supabase = await createClient();

    const { data: application, error } = await supabase
      .from("applications")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error) {
      return null;
    }

    return application;
  } catch (error) {
    return null;
  }
}

async function getLinkedinProfilesViaSupabase(
  applicationId: string,
  userId: string
) {
  try {
    const supabase = await createClient();

    // Verify the application belongs to the user
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("user_id", userId)
      .single();

    if (appError || !application) {
      return [];
    }

    const { data: profiles, error } = await supabase
      .from("linkedin_profiles")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: true });

    if (error) {
      return [];
    }

    return profiles || [];
  } catch (error) {
    return [];
  }
}


// ---------------------------------------------------------------------------
// Drizzle rollout wrappers
//
// Each helper below keeps its original signature and routes through dualRead,
// which honours DRIZZLE_MODE: `off` (default) runs Supabase only, `shadow` runs
// both and logs mismatches while returning the Supabase result, `on` runs Drizzle.
//
// Parity was confirmed against production for 25 real users before this landed;
// see scripts/migration/verify-drizzle-parity.mjs.
// ---------------------------------------------------------------------------

export async function getProfile(userId: string) {
  return dualRead(
    "getProfile",
    () => getProfileViaSupabase(userId),
    async () => (await import("@/lib/db/queries")).getProfile(userId)
  );
}

export async function getSubscription(userId: string) {
  return dualRead(
    "getSubscription",
    () => getSubscriptionViaSupabase(userId),
    async () => (await import("@/lib/db/queries")).getSubscription(userId)
  );
}

export async function getUsage(userId: string) {
  return dualRead(
    "getUsage",
    () => getUsageViaSupabase(userId),
    async () => (await import("@/lib/db/queries")).getUsage(userId)
  );
}

export async function getApplications(userId: string) {
  return dualRead(
    "getApplications",
    () => getApplicationsViaSupabase(userId),
    async () => (await import("@/lib/db/queries")).getApplications(userId)
  );
}

export async function getArchivedApplications(userId: string) {
  return dualRead(
    "getArchivedApplications",
    () => getArchivedApplicationsViaSupabase(userId),
    async () => (await import("@/lib/db/queries")).getArchivedApplications(userId)
  );
}

export async function getApplicationHistory(userId: string) {
  return dualRead(
    "getApplicationHistory",
    () => getApplicationHistoryViaSupabase(userId),
    async () => (await import("@/lib/db/queries")).getApplicationHistory(userId)
  );
}

export async function getApplication(id: string, userId: string) {
  return dualRead(
    "getApplication",
    () => getApplicationViaSupabase(id, userId),
    async () => (await import("@/lib/db/queries")).getApplication(id, userId)
  );
}

export async function getLinkedinProfiles(applicationId: string, userId: string) {
  return dualRead(
    "getLinkedinProfiles",
    () => getLinkedinProfilesViaSupabase(applicationId, userId),
    async () => (await import("@/lib/db/queries")).getLinkedinProfiles(applicationId, userId)
  );
}
