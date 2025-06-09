import { supabase } from "./supabase"

export async function trackStatusChange(
  applicationId: string,
  oldStatus: string | null,
  newStatus: string,
  notes?: string,
) {
  try {
    const { error } = await supabase.from("application_history").insert({
      application_id: applicationId,
      old_status: oldStatus,
      new_status: newStatus,
      notes: notes || null,
    })

    if (error) {
      console.error("Error tracking status change:", error)
    }
  } catch (error) {
    console.error("Error tracking status change:", error)
  }
}

export async function getApplicationHistory(applicationId: string) {
  try {
    const { data, error } = await supabase
      .from("application_history")
      .select("*")
      .eq("application_id", applicationId)
      .order("changed_at", { ascending: true })

    if (error) {
      console.error("Error fetching application history:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("Error fetching application history:", error)
    return []
  }
}
