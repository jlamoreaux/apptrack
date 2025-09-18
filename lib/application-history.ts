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
    }
  } catch (error) {
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
      return []
    }

    return data || []
  } catch (error) {
    return []
  }
}
