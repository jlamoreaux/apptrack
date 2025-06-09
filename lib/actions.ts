"use server"

import { createClient } from "./supabase-server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { stripe } from "./stripe"

// Validation schemas
const signUpSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

const applicationSchema = z.object({
  company: z.string().min(1, "Company name is required"),
  role: z.string().min(1, "Role title is required"),
  role_link: z.string().url().optional().or(z.literal("")),
  date_applied: z.string().min(1, "Date applied is required"),
  status: z.enum(["Applied", "Interview Scheduled", "Interviewed", "Offer", "Rejected"]),
})

const linkedinProfileSchema = z.object({
  profile_url: z.string().url("Invalid LinkedIn URL"),
  name: z.string().optional(),
  title: z.string().optional(),
})

const profileUpdateSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
})

// Auth actions
export async function signUpAction(formData: FormData) {
  try {
    const rawData = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    }

    const result = signUpSchema.safeParse(rawData)

    if (!result.success) {
      return {
        error: result.error.errors[0].message,
      }
    }

    const { name, email, password } = result.data
    const supabase = await createClient()

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    })

    if (error) {
      return {
        error: error.message,
      }
    }

    redirect("/dashboard")
  } catch (error) {
    console.error("Sign up error:", error)
    return { error: "An unexpected error occurred during sign up" }
  }
}

export async function signInAction(formData: FormData) {
  try {
    const rawData = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    }

    const result = signInSchema.safeParse(rawData)

    if (!result.success) {
      return {
        error: result.error.errors[0].message,
      }
    }

    const { email, password } = result.data
    const supabase = await createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return {
        error: error.message,
      }
    }

    redirect("/dashboard")
  } catch (error) {
    console.error("Sign in error:", error)
    return { error: "An unexpected error occurred during sign in" }
  }
}

export async function signOutAction() {
  try {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect("/")
  } catch (error) {
    console.error("Sign out error:", error)
    redirect("/")
  }
}

// Profile update action
export async function updateProfileAction(formData: FormData) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated" }
    }

    const rawData = {
      full_name: formData.get("full_name") as string,
    }

    const result = profileUpdateSchema.safeParse(rawData)

    if (!result.success) {
      return {
        error: result.error.errors[0].message,
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: result.data.full_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/dashboard/settings")
    return { success: true }
  } catch (error) {
    console.error("Profile update error:", error)
    return { error: "An unexpected error occurred during profile update" }
  }
}

// Application actions
export async function addApplicationAction(formData: FormData) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated" }
    }

    const rawData = {
      company: formData.get("company") as string,
      role: formData.get("role") as string,
      role_link: formData.get("role_link") as string,
      date_applied: formData.get("date_applied") as string,
      status: formData.get("status") as string,
    }

    const result = applicationSchema.safeParse(rawData)

    if (!result.success) {
      return {
        error: result.error.errors[0].message,
      }
    }

    // Check usage limits
    const { data: usage } = await supabase
      .from("usage_tracking")
      .select("applications_count")
      .eq("user_id", user.id)
      .single()

    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select(`
      *,
      subscription_plans (max_applications)
    `)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single()

    if (subscription?.subscription_plans?.max_applications !== -1) {
      const maxApps = subscription?.subscription_plans?.max_applications || 0
      const currentCount = usage?.applications_count || 0

      if (currentCount >= maxApps) {
        return {
          error: "You've reached your application limit. Please upgrade to Pro for unlimited applications.",
        }
      }
    }

    const { error } = await supabase.from("applications").insert([
      {
        ...result.data,
        user_id: user.id,
      },
    ])

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/dashboard")
    redirect("/dashboard")
  } catch (error) {
    console.error("Add application error:", error)
    return { error: "An unexpected error occurred while adding the application" }
  }
}

export async function updateApplicationAction(applicationId: string, formData: FormData) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated" }
    }

    const status = formData.get("status") as string
    const notes = formData.get("notes") as string

    const { error } = await supabase
      .from("applications")
      .update({ status, notes })
      .eq("id", applicationId)
      .eq("user_id", user.id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath(`/dashboard/application/${applicationId}`)

    // Return status for client-side modal handling
    return { status }
  } catch (error) {
    console.error("Update application error:", error)
    return { error: "An unexpected error occurred while updating the application" }
  }
}

export async function addLinkedinProfileAction(applicationId: string, formData: FormData) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated" }
    }

    const rawData = {
      profile_url: formData.get("profile_url") as string,
      name: formData.get("name") as string,
      title: formData.get("title") as string,
    }

    const result = linkedinProfileSchema.safeParse(rawData)

    if (!result.success) {
      return {
        error: result.error.errors[0].message,
      }
    }

    // Verify the application belongs to the user
    const { data: application } = await supabase
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single()

    if (!application) {
      return { error: "Application not found" }
    }

    const { error } = await supabase.from("linkedin_profiles").insert([
      {
        ...result.data,
        application_id: applicationId,
      },
    ])

    if (error) {
      return { error: error.message }
    }

    revalidatePath(`/dashboard/application/${applicationId}`)
    return { success: true }
  } catch (error) {
    console.error("Add LinkedIn profile error:", error)
    return { error: "An unexpected error occurred while adding the LinkedIn profile" }
  }
}

export async function deleteLinkedinProfileAction(profileId: string, applicationId: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated" }
    }

    // Verify the profile belongs to the user's application
    const { data: profile } = await supabase
      .from("linkedin_profiles")
      .select(`
      id,
      applications!inner(user_id)
    `)
      .eq("id", profileId)
      .single()

    if (!profile || profile.applications.user_id !== user.id) {
      return { error: "Profile not found" }
    }

    const { error } = await supabase.from("linkedin_profiles").delete().eq("id", profileId)

    if (error) {
      return { error: error.message }
    }

    revalidatePath(`/dashboard/application/${applicationId}`)
    return { success: true }
  } catch (error) {
    console.error("Delete LinkedIn profile error:", error)
    return { error: "An unexpected error occurred while deleting the LinkedIn profile" }
  }
}

// Account deletion action
export async function deleteAccountAction(formData: FormData) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated" }
    }

    const userId = formData.get("userId") as string

    if (userId !== user.id) {
      return { error: "Unauthorized" }
    }

    try {
      // First, check if user has an active subscription and cancel it
      const { data: subscription } = await supabase
        .from("user_subscriptions")
        .select("stripe_subscription_id, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single()

      if (subscription?.stripe_subscription_id) {
        try {
          // Cancel the Stripe subscription immediately
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
        } catch (stripeError) {
          console.error("Error canceling Stripe subscription:", stripeError)
          // Continue with account deletion even if Stripe cancellation fails
        }
      }

      // Delete user data in the correct order (due to foreign key constraints)
      // 1. LinkedIn profiles (references applications)
      await supabase
        .from("linkedin_profiles")
        .delete()
        .in("application_id", supabase.from("applications").select("id").eq("user_id", user.id))

      // 2. Applications (references user)
      await supabase.from("applications").delete().eq("user_id", user.id)

      // 3. Usage tracking (references user)
      await supabase.from("usage_tracking").delete().eq("user_id", user.id)

      // 4. User subscriptions (references user)
      await supabase.from("user_subscriptions").delete().eq("user_id", user.id)

      // 5. Profile (references user)
      await supabase.from("profiles").delete().eq("id", user.id)

      // 6. Finally, delete the auth user
      const { error: authError } = await supabase.auth.admin.deleteUser(user.id)

      if (authError) {
        console.error("Error deleting auth user:", authError)
        return { error: "Failed to delete account. Please contact support." }
      }

      // Sign out the user
      await supabase.auth.signOut()
    } catch (error) {
      console.error("Error deleting account:", error)
      return { error: "Failed to delete account. Please contact support." }
    }

    // Redirect to home page
    redirect("/")
  } catch (error) {
    console.error("Account deletion error:", error)
    return { error: "An unexpected error occurred during account deletion" }
  }
}

// Archive application action
export async function archiveApplicationAction(applicationId: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated" }
    }

    const { error } = await supabase
      .from("applications")
      .update({ archived: true, updated_at: new Date().toISOString() })
      .eq("id", applicationId)
      .eq("user_id", user.id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/dashboard")
    return { success: true }
  } catch (error) {
    console.error("Archive application error:", error)
    return { error: "An unexpected error occurred while archiving the application" }
  }
}

// Unarchive application action
export async function unarchiveApplicationAction(applicationId: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated" }
    }

    const { error } = await supabase
      .from("applications")
      .update({ archived: false, updated_at: new Date().toISOString() })
      .eq("id", applicationId)
      .eq("user_id", user.id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/archived")
    return { success: true }
  } catch (error) {
    console.error("Unarchive application error:", error)
    return { error: "An unexpected error occurred while unarchiving the application" }
  }
}

// Delete application action
export async function deleteApplicationAction(applicationId: string) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { error: "Not authenticated" }
    }

    // Delete related LinkedIn profiles first
    await supabase.from("linkedin_profiles").delete().eq("application_id", applicationId)

    // Delete application history
    await supabase.from("application_history").delete().eq("application_id", applicationId)

    // Delete the application
    const { error } = await supabase.from("applications").delete().eq("id", applicationId).eq("user_id", user.id)

    if (error) {
      return { error: error.message }
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/archived")
    return { success: true }
  } catch (error) {
    console.error("Delete application error:", error)
    return { error: "An unexpected error occurred while deleting the application" }
  }
}
