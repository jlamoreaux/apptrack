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

export async function getProfile(userId: string) {
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

export async function getSubscription(userId: string) {
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

export async function getUsage(userId: string) {
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

export async function getApplications(userId: string) {
  try {
    const supabase = await createClient();

    const { data: applications, error } = await supabase
      .from("applications")
      .select(`
        *,
        ai_analyses:application_ai_analyses(
          job_fit_count,
          cover_letter_count,
          interview_prep_count,
          latest_job_fit,
          latest_cover_letter,
          latest_interview_prep,
          best_fit_score
        )
      `)
      .eq("user_id", userId)
      .eq("archived", false) // Only get non-archived applications
      .order("created_at", { ascending: false });

    if (error) {
      return [];
    }

    // Transform the joined data to match ApplicationWithAnalyses type
    return (applications || []).map((app: any) => ({
      ...app,
      ai_analyses: app.ai_analyses?.[0] || undefined,
    }));
  } catch (error) {
    return [];
  }
}

export async function getArchivedApplications(userId: string) {
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

export async function getApplicationHistory(userId: string) {
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

export async function getApplication(id: string, userId: string) {
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

export async function getLinkedinProfiles(
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
