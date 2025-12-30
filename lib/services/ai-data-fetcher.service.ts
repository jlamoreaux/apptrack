import { createClient } from "@/lib/supabase/server";

export interface AIDataContext {
  resumeText: string | null;
  resumeId: string | null;
  jobDescription: string | null;
  applicationData: {
    company: string;
    role: string;
    roleLink?: string | null;
    notes?: string | null;
  } | null;
}

export class AIDataFetcherService {
  /**
   * Fetches user's current resume data
   */
  static async getUserResume(userId: string): Promise<{ text: string | null; id: string | null }> {
    const supabase = await createClient();

    // Get the default resume for the user (or most recent if no default)
    const { data: defaultResume } = await supabase
      .from("user_resumes")
      .select("id, extracted_text")
      .eq("user_id", userId)
      .eq("is_default", true)
      .maybeSingle();

    if (defaultResume) {
      return {
        text: defaultResume.extracted_text || null,
        id: defaultResume.id
      };
    }

    // Fallback: Get the most recent resume
    const { data: resume, error } = await supabase
      .from("user_resumes")
      .select("id, extracted_text")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !resume) {
      return { text: null, id: null };
    }

    return {
      text: resume.extracted_text || null,
      id: resume.id
    };
  }

  /**
   * Fetches a specific resume by ID
   */
  static async getUserResumeById(userId: string, resumeId: string): Promise<{ text: string | null; id: string | null }> {
    const supabase = await createClient();

    const { data: resume, error } = await supabase
      .from("user_resumes")
      .select("id, extracted_text")
      .eq("id", resumeId)
      .eq("user_id", userId) // Ensure user owns this resume
      .single();

    if (error || !resume) {
      return { text: null, id: null };
    }

    return {
      text: resume.extracted_text || null,
      id: resume.id
    };
  }

  /**
   * Fetches job description from an application
   */
  static async getApplicationJobDescription(
    userId: string, 
    applicationId: string
  ): Promise<string | null> {
    const supabase = await createClient();
    
    // First check if job_description column exists
    const { data: application, error } = await supabase
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .eq("user_id", userId)
      .single();

    if (error || !application) {
      return null;
    }

    // Check if we have a job_description field (might be added later)
    if ('job_description' in application && application.job_description) {
      return application.job_description as string;
    }

    // Check if we have it stored in job_fit_analysis table
    const { data: analysis } = await supabase
      .from("job_fit_analysis")
      .select("job_description")
      .eq("application_id", applicationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (analysis?.job_description) {
      return analysis.job_description;
    }

    // Check cover letters table
    const { data: coverLetter } = await supabase
      .from("cover_letters")
      .select("job_description")
      .eq("application_id", applicationId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (coverLetter?.job_description) {
      return coverLetter.job_description;
    }

    return null;
  }

  /**
   * Gets complete AI context for an application
   */
  static async getAIContext(
    userId: string,
    applicationId?: string
  ): Promise<AIDataContext> {
    const [resume, jobDescription, applicationData] = await Promise.all([
      this.getUserResume(userId),
      applicationId ? this.getApplicationJobDescription(userId, applicationId) : Promise.resolve(null),
      applicationId ? this.getApplicationData(userId, applicationId) : Promise.resolve(null)
    ]);

    return {
      resumeText: resume.text,
      resumeId: resume.id,
      jobDescription,
      applicationData
    };
  }

  /**
   * Gets application data
   */
  private static async getApplicationData(userId: string, applicationId: string) {
    const supabase = await createClient();
    
    const { data: application } = await supabase
      .from("applications")
      .select("company, role, role_link, notes")
      .eq("id", applicationId)
      .eq("user_id", userId)
      .single();

    return application || null;
  }

  /**
   * Saves job description for future use
   * Returns success status and any errors encountered
   */
  static async saveJobDescription(
    userId: string,
    applicationId: string,
    jobDescription: string
  ): Promise<{ success: boolean; errors: string[] }> {
    const supabase = await createClient();
    const errors: string[] = [];

    // Try to update the application if job_description column exists
    try {
      const { error } = await supabase
        .from("applications")
        .update({ job_description: jobDescription })
        .eq("id", applicationId)
        .eq("user_id", userId);

      // Only log if it's not a "column doesn't exist" error
      if (error && error.code !== '42703') {
        errors.push(`Failed to update application: ${error.message}`);
        console.warn('[AIDataFetcher] Failed to save job description to applications table:', error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Unexpected error updating application: ${errorMessage}`);
      console.error('[AIDataFetcher] Unexpected error updating application:', error);
    }

    // Also save in job_fit_analysis table
    try {
      const { error } = await supabase
        .from("job_fit_analysis")
        .upsert({
          user_id: userId,
          application_id: applicationId,
          job_description: jobDescription,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,application_id'
        });

      if (error) {
        errors.push(`Failed to save to job_fit_analysis: ${error.message}`);
        console.error('[AIDataFetcher] Failed to save job description to job_fit_analysis:', error);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Unexpected error: ${errorMessage}`);
      console.error('[AIDataFetcher] Unexpected error saving to job_fit_analysis:', error);
    }

    return { success: errors.length === 0, errors };
  }
}