"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase-client"
import type { Application, LinkedinProfile } from "@/lib/supabase"

export function useSupabaseApplications(userId: string | null) {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  const fetchApplications = async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from("applications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching applications:", error)
        return
      }

      setApplications(data || [])
    } catch (error) {
      console.error("Error fetching applications:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApplications()
  }, [userId])

  const addApplication = async (applicationData: {
    company: string
    role: string
    role_link?: string
    date_applied: string
    status?: string
  }) => {
    if (!userId) return { success: false, error: "User not authenticated" }

    // Check if user can add more applications
    const { data: usage } = await supabase
      .from("usage_tracking")
      .select("applications_count")
      .eq("user_id", userId)
      .single()

    const { data: subscription } = await supabase
      .from("user_subscriptions")
      .select(`
      *,
      subscription_plans (max_applications)
    `)
      .eq("user_id", userId)
      .eq("status", "active")
      .single()

    if (subscription?.subscription_plans?.max_applications !== -1) {
      const maxApps = subscription?.subscription_plans?.max_applications || 0
      const currentCount = usage?.applications_count || 0

      if (currentCount >= maxApps) {
        return {
          success: false,
          error: "You've reached your application limit. Please upgrade to Pro for unlimited applications.",
        }
      }
    }

    // Rest of the existing function...
    try {
      const { data, error } = await supabase
        .from("applications")
        .insert([
          {
            ...applicationData,
            user_id: userId,
            status: applicationData.status || "Applied",
          },
        ])
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      setApplications((prev) => [data, ...prev])
      return { success: true, application: data }
    } catch (error) {
      return { success: false, error: "Failed to add application" }
    }
  }

  const updateApplication = async (id: string, updates: Partial<Application>) => {
    try {
      const { data, error } = await supabase.from("applications").update(updates).eq("id", id).select().single()

      if (error) {
        return { success: false, error: error.message }
      }

      setApplications((prev) => prev.map((app) => (app.id === id ? data : app)))
      return { success: true, application: data }
    } catch (error) {
      return { success: false, error: "Failed to update application" }
    }
  }

  const deleteApplication = async (id: string) => {
    try {
      const { error } = await supabase.from("applications").delete().eq("id", id)

      if (error) {
        return { success: false, error: error.message }
      }

      setApplications((prev) => prev.filter((app) => app.id !== id))
      return { success: true }
    } catch (error) {
      return { success: false, error: "Failed to delete application" }
    }
  }

  const getApplication = async (id: string): Promise<Application | null> => {
    try {
      const { data, error } = await supabase.from("applications").select("*").eq("id", id).single()

      if (error) {
        console.error("Error fetching application:", error)
        return null
      }

      return data
    } catch (error) {
      console.error("Error fetching application:", error)
      return null
    }
  }

  return {
    applications,
    loading,
    addApplication,
    updateApplication,
    deleteApplication,
    getApplication,
    refetch: fetchApplications,
  }
}

export function useLinkedinProfiles(applicationId: string | null) {
  const [profiles, setProfiles] = useState<LinkedinProfile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProfiles = async () => {
    if (!applicationId) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from("linkedin_profiles")
        .select("*")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching LinkedIn profiles:", error)
        return
      }

      setProfiles(data || [])
    } catch (error) {
      console.error("Error fetching LinkedIn profiles:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfiles()
  }, [applicationId])

  const addProfile = async (profileData: {
    profile_url: string
    name?: string
    title?: string
  }) => {
    if (!applicationId) return { success: false, error: "Application ID required" }

    try {
      const { data, error } = await supabase
        .from("linkedin_profiles")
        .insert([
          {
            ...profileData,
            application_id: applicationId,
          },
        ])
        .select()
        .single()

      if (error) {
        return { success: false, error: error.message }
      }

      setProfiles((prev) => [data, ...prev])
      return { success: true, profile: data }
    } catch (error) {
      return { success: false, error: "Failed to add LinkedIn profile" }
    }
  }

  const deleteProfile = async (id: string) => {
    try {
      const { error } = await supabase.from("linkedin_profiles").delete().eq("id", id)

      if (error) {
        return { success: false, error: error.message }
      }

      setProfiles((prev) => prev.filter((profile) => profile.id !== id))
      return { success: true }
    } catch (error) {
      return { success: false, error: "Failed to delete LinkedIn profile" }
    }
  }

  return {
    profiles,
    loading,
    addProfile,
    deleteProfile,
    refetch: fetchProfiles,
  }
}
