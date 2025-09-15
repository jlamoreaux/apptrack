"use server";

import { createClient } from "../supabase/server";
import { AIDataFetcherService } from "../services/ai-data-fetcher.service";

/**
 * Server action to save a job description for an application
 */
export async function saveJobDescriptionAction(
  applicationId: string,
  jobDescription: string
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Verify the application belongs to the user
    const { data: application, error: fetchError } = await supabase
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !application) {
      return { error: "Application not found" };
    }

    // Update the application with the job description
    const { error: updateError } = await supabase
      .from("applications")
      .update({ 
        job_description: jobDescription,
        updated_at: new Date().toISOString()
      })
      .eq("id", applicationId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error updating job description:", updateError);
      // Try alternative storage method
      await AIDataFetcherService.saveJobDescription(user.id, applicationId, jobDescription);
    }

    return { success: true };
  } catch (error) {
    console.error("Save job description error:", error);
    return {
      error: "Failed to save job description",
    };
  }
}

/**
 * Server action to get AI context for an application
 */
export async function getAIContextAction(applicationId?: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const context = await AIDataFetcherService.getAIContext(
      user.id,
      applicationId
    );

    return { data: context };
  } catch (error) {
    console.error("Get AI context error:", error);
    return {
      error: "Failed to get AI context",
    };
  }
}