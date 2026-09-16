import { supabase } from "./supabase"

/**
 * NOTE: status transitions are recorded server-side by
 * PUT /api/applications/[id], which is the single funnel every status change
 * goes through. `trackStatusChange` below is kept for direct/legacy callers
 * only — do not call it from the update path or rows will be written twice.
 */

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
