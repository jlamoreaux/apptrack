import { createClient } from "./supabase-server";
import { redirect } from "next/navigation";

export async function getUser() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("Error getting user:", error);
      return null;
    }

    return user;
  } catch (error) {
    console.error("Exception getting user:", error);
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
      console.error("Error getting profile:", error);
      return null;
    }

    return profile;
  } catch (error) {
    console.error("Exception getting profile:", error);
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
      .eq("status", "active")
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error getting subscription:", error);
      return null;
    }

    return subscription;
  } catch (error) {
    console.error("Exception getting subscription:", error);
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
      console.error("Error getting usage:", error);
      return null;
    }

    return usage;
  } catch (error) {
    console.error("Exception getting usage:", error);
    return null;
  }
}

export async function getApplications(userId: string) {
  try {
    const supabase = await createClient();

    const { data: applications, error } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", false) // Only get non-archived applications
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error getting applications:", error);
      return [];
    }

    return applications || [];
  } catch (error) {
    console.error("Exception getting applications:", error);
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
      console.error("Error getting archived applications:", error);
      return [];
    }

    return applications || [];
  } catch (error) {
    console.error("Error in getArchivedApplications:", error);
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
      console.error("Error getting application history:", error);
      return [];
    }

    return history || [];
  } catch (error) {
    console.error("Exception getting application history:", error);
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
      console.error("Error getting application:", error);
      return null;
    }

    return application;
  } catch (error) {
    console.error("Exception getting application:", error);
    return null;
  }
}

export async function getLinkedinProfiles(
  applicationId: string,
  userId: string
) {
  try {
    const supabase = await createClient();

    const { data: profiles, error } = await supabase
      .from("linkedin_profiles")
      .select("*")
      .eq("application_id", applicationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error getting LinkedIn profiles:", error);
      return [];
    }

    // Verify the application belongs to the user
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("user_id")
      .eq("id", applicationId)
      .eq("user_id", userId)
      .single();

    if (appError || !application) {
      console.error("Application verification failed:", appError);
      return [];
    }

    return profiles || [];
  } catch (error) {
    console.error("Exception getting LinkedIn profiles:", error);
    return [];
  }
}
