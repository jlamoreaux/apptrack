import { createClient } from "./supabase-server"
import { redirect } from "next/navigation"

// Helper function to add timeout to any promise
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback?: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        if (fallback !== undefined) {
          resolve(fallback)
        } else {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`))
        }
      }, timeoutMs)
    }),
  ])
}

export async function getUser() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error,
    } = await withTimeout(supabase.auth.getUser(), 3000, {
      data: { user: null },
      error: new Error("Timeout getting user"),
    })

    if (error) {
      console.error("Error getting user:", error)
      return null
    }

    return user
  } catch (error) {
    console.error("Exception getting user:", error)
    return null
  }
}

export async function requireAuth() {
  const user = await getUser()

  if (!user) {
    redirect("/login")
  }

  return user
}

export async function getProfile(userId: string) {
  try {
    const supabase = await createClient()

    const { data: profile, error } = await withTimeout(
      supabase.from("profiles").select("*").eq("id", userId).single(),
      3000,
      { data: null, error: new Error("Timeout getting profile") },
    )

    if (error) {
      console.error("Error getting profile:", error)
      return null
    }

    return profile
  } catch (error) {
    console.error("Exception getting profile:", error)
    return null
  }
}

export async function getSubscription(userId: string) {
  try {
    const supabase = await createClient()

    const { data: subscription, error } = await withTimeout(
      supabase
        .from("user_subscriptions")
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      3000,
      { data: null, error: new Error("Timeout getting subscription") },
    )

    if (error && error.code !== "PGRST116") {
      console.error("Error getting subscription:", error)
      return null
    }

    return subscription
  } catch (error) {
    console.error("Exception getting subscription:", error)
    return null
  }
}

export async function getUsage(userId: string) {
  try {
    const supabase = await createClient()

    const { data: usage, error } = await withTimeout(
      supabase.from("usage_tracking").select("*").eq("user_id", userId).single(),
      3000,
      { data: null, error: new Error("Timeout getting usage") },
    )

    if (error && error.code !== "PGRST116") {
      console.error("Error getting usage:", error)
      return null
    }

    return usage
  } catch (error) {
    console.error("Exception getting usage:", error)
    return null
  }
}

export async function getApplications(userId: string) {
  try {
    const supabase = await createClient()

    const { data: applications, error } = await withTimeout(
      supabase
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", false) // Only get non-archived applications
        .order("created_at", { ascending: false }),
      5000,
      { data: [], error: new Error("Timeout getting applications") },
    )

    if (error) {
      console.error("Error getting applications:", error)
      return []
    }

    return applications || []
  } catch (error) {
    console.error("Exception getting applications:", error)
    return []
  }
}

export async function getArchivedApplications(userId: string) {
  try {
    const supabase = await createClient()

    const { data: applications, error } = await withTimeout(
      supabase
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .eq("archived", true) // Only get archived applications
        .order("updated_at", { ascending: false }),
      5000,
      { data: [], error: new Error("Timeout getting archived applications") },
    )

    if (error) {
      console.error("Error getting archived applications:", error)
      return []
    }

    return applications || []
  } catch (error) {
    console.error("Error in getArchivedApplications:", error)
    return []
  }
}

export async function getApplicationHistory(userId: string) {
  try {
    const supabase = await createClient()

    const { data: history, error } = await withTimeout(
      supabase
        .from("application_history")
        .select(`
          *,
          applications!inner(user_id)
        `)
        .eq("applications.user_id", userId)
        .order("changed_at", { ascending: true }),
      3000,
      { data: [], error: new Error("Timeout getting application history") },
    )

    if (error) {
      console.error("Error getting application history:", error)
      return []
    }

    return history || []
  } catch (error) {
    console.error("Exception getting application history:", error)
    return []
  }
}

export async function getApplication(id: string, userId: string) {
  try {
    const supabase = await createClient()

    const { data: application, error } = await withTimeout(
      supabase.from("applications").select("*").eq("id", id).eq("user_id", userId).single(),
      3000,
      { data: null, error: new Error("Timeout getting application") },
    )

    if (error) {
      console.error("Error getting application:", error)
      return null
    }

    return application
  } catch (error) {
    console.error("Exception getting application:", error)
    return null
  }
}

export async function getLinkedinProfiles(applicationId: string, userId: string) {
  try {
    const supabase = await createClient()

    const { data: profiles, error } = await withTimeout(
      supabase
        .from("linkedin_profiles")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false }),
      3000,
      { data: [], error: new Error("Timeout getting LinkedIn profiles") },
    )

    if (error) {
      console.error("Error getting LinkedIn profiles:", error)
      return []
    }

    // Verify the application belongs to the user
    const { data: application, error: appError } = await withTimeout(
      supabase.from("applications").select("user_id").eq("id", applicationId).eq("user_id", userId).single(),
      3000,
      { data: null, error: new Error("Timeout verifying application") },
    )

    if (appError || !application) {
      console.error("Application verification failed:", appError)
      return []
    }

    return profiles || []
  } catch (error) {
    console.error("Exception getting LinkedIn profiles:", error)
    return []
  }
}
