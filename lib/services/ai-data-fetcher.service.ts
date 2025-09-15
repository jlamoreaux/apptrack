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
    
    const { data: resume, error } = await supabase
      .from("user_resumes")
      .select("id, extracted_text, parsed_content")
      .eq("user_id", userId)
      .eq("is_current", true)
      .single();

    if (error || !resume) {
      // Fallback to most recent resume if no current resume marked
      const { data: latestResume } = await supabase
        .from("user_resumes")
        .select("id, extracted_text, parsed_content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (latestResume) {
        return {
          text: latestResume.extracted_text || latestResume.parsed_content || null,
          id: latestResume.id
        };
      }
      
      return { text: null, id: null };
    }

    return {
      text: resume.extracted_text || resume.parsed_content || null,
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

    // Check if we have it stored in job_fit_analyses table
    const { data: analysis } = await supabase
      .from("job_fit_analyses")
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
   */
  static async saveJobDescription(
    userId: string,
    applicationId: string,
    jobDescription: string
  ): Promise<void> {
    const supabase = await createClient();
    
    // Try to update the application if job_description column exists
    // This will fail silently if the column doesn't exist yet
    try {
      await supabase
        .from("applications")
        .update({ job_description: jobDescription })
        .eq("id", applicationId)
        .eq("user_id", userId);
    } catch (error) {
      console.log("job_description column might not exist yet in applications table");
    }

    // Also save in job_fit_analyses for backward compatibility
    await supabase
      .from("job_fit_analyses")
      .upsert({
        user_id: userId,
        application_id: applicationId,
        job_description: jobDescription,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,application_id'
      });
  }
}