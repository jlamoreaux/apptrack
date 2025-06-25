import { createClient } from "@/lib/supabase/server";
import { BaseDAL, DALError, NotFoundError, ValidationError } from "../base";
import type {
  ResumeAnalysis,
  InterviewPrep,
  CareerAdvice,
  CoverLetter,
  JobFitAnalysis,
} from "@/types";

// Resume Analysis
export interface CreateResumeAnalysisInput {
  user_id: string;
  user_resume_id?: string;
  resume_text?: string;
  job_description?: string;
  job_url?: string;
  analysis_result: any;
}

export interface UpdateResumeAnalysisInput {
  user_resume_id?: string;
  resume_text?: string;
  job_description?: string;
  job_url?: string;
  analysis_result?: any;
}

// Interview Prep
export interface CreateInterviewPrepInput {
  user_id: string;
  job_description?: string;
  job_url?: string;
  user_resume_id?: string;
  resume_text?: string;
  user_background?: string;
  prep_content: string;
}

export interface UpdateInterviewPrepInput {
  job_description?: string;
  prep_content?: string;
}

// Career Advice
export interface CreateCareerAdviceInput {
  user_id: string;
  question: string;
  advice: string;
}

export interface UpdateCareerAdviceInput {
  question?: string;
  advice?: string;
}

// Cover Letter
export interface CreateCoverLetterInput {
  user_id: string;
  job_description: string;
  cover_letter: string;
}

export interface UpdateCoverLetterInput {
  job_description?: string;
  cover_letter?: string;
}

// Job Fit Analysis
export interface CreateJobFitAnalysisInput {
  user_id: string;
  job_description: string;
  analysis_result: string;
  fit_score: number;
}

export interface UpdateJobFitAnalysisInput {
  job_description?: string;
  analysis_result?: string;
  fit_score?: number;
}

export class ResumeAnalysisDAL
  implements
    BaseDAL<
      ResumeAnalysis,
      CreateResumeAnalysisInput,
      UpdateResumeAnalysisInput
    >
{
  async create(data: CreateResumeAnalysisInput): Promise<ResumeAnalysis> {
    try {
      const supabase = await createClient();
      const { data: analysis, error } = await supabase
        .from("resume_analysis")
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new ValidationError(
          `Failed to create resume analysis: ${error.message}`
        );
      }

      return analysis;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to create resume analysis",
        "CREATE_ERROR",
        error
      );
    }
  }

  async findById(id: string): Promise<ResumeAnalysis | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("resume_analysis")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to find resume analysis: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to find resume analysis",
        "QUERY_ERROR",
        error
      );
    }
  }

  async findByUserId(userId: string): Promise<ResumeAnalysis[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("resume_analysis")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new DALError(
          `Failed to find resume analyses: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to find resume analyses",
        "QUERY_ERROR",
        error
      );
    }
  }

  async update(
    id: string,
    data: UpdateResumeAnalysisInput
  ): Promise<ResumeAnalysis | null> {
    try {
      const supabase = await createClient();
      const { data: updatedAnalysis, error } = await supabase
        .from("resume_analysis")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to update resume analysis: ${error.message}`,
          "UPDATE_ERROR"
        );
      }

      return updatedAnalysis;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to update resume analysis",
        "UPDATE_ERROR",
        error
      );
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("resume_analysis")
        .delete()
        .eq("id", id);

      if (error) {
        throw new DALError(
          `Failed to delete resume analysis: ${error.message}`,
          "DELETE_ERROR"
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to delete resume analysis",
        "DELETE_ERROR",
        error
      );
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("resume_analysis")
        .select("id")
        .eq("id", id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new DALError(
          `Failed to check resume analysis existence: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return !!data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to check resume analysis existence",
        "QUERY_ERROR",
        error
      );
    }
  }

  async count(userId?: string): Promise<number> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from("resume_analysis")
        .select("id", { count: "exact", head: true });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { count, error } = await query;

      if (error) {
        throw new DALError(
          `Failed to count resume analyses: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return count || 0;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to count resume analyses",
        "QUERY_ERROR",
        error
      );
    }
  }

  async findExistingAnalysis({
    user_id,
    user_resume_id,
    resume_text,
    job_description,
    job_url,
  }: {
    user_id: string;
    user_resume_id?: string;
    resume_text?: string;
    job_description?: string;
    job_url?: string;
  }): Promise<ResumeAnalysis | null> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from("resume_analysis")
        .select("*")
        .eq("user_id", user_id);

      // Priority 1: user_resume_id + job_url
      if (user_resume_id && job_url) {
        query = query
          .eq("user_resume_id", user_resume_id)
          .eq("job_url", job_url);
      }
      // Priority 2: user_resume_id + job_description
      else if (user_resume_id && job_description) {
        query = query
          .eq("user_resume_id", user_resume_id)
          .eq("job_description", job_description);
      }
      // Priority 3: resume_text + job_url
      else if (resume_text && job_url) {
        query = query.eq("resume_text", resume_text).eq("job_url", job_url);
      }
      // Priority 4: resume_text + job_description
      else if (resume_text && job_description) {
        query = query
          .eq("resume_text", resume_text)
          .eq("job_description", job_description);
      }
      // If only one or neither, fallback to previous logic (less strict)
      else {
        if (user_resume_id) {
          query = query.eq("user_resume_id", user_resume_id);
        } else if (resume_text) {
          query = query.eq("resume_text", resume_text);
        }
        if (job_description) {
          query = query.eq("job_description", job_description);
        } else if (job_url) {
          query = query.eq("job_url", job_url);
        }
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) {
        throw new DALError(
          `Failed to find existing resume analysis: ${error.message}`,
          "QUERY_ERROR"
        );
      }
      console.log("Found existing resume analysis", data[0].id);
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to find existing resume analysis",
        "QUERY_ERROR",
        error
      );
    }
  }
}

export class InterviewPrepDAL
  implements
    BaseDAL<InterviewPrep, CreateInterviewPrepInput, UpdateInterviewPrepInput>
{
  async create(data: CreateInterviewPrepInput): Promise<InterviewPrep> {
    try {
      const supabase = await createClient();
      const { data: prep, error } = await supabase
        .from("interview_prep")
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new ValidationError(
          `Failed to create interview prep: ${error.message}`
        );
      }

      return prep;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to create interview prep",
        "CREATE_ERROR",
        error
      );
    }
  }

  async findById(id: string): Promise<InterviewPrep | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("interview_prep")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to find interview prep: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find interview prep", "QUERY_ERROR", error);
    }
  }

  async findByUserId(userId: string): Promise<InterviewPrep[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("interview_prep")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new DALError(
          `Failed to find interview preps: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to find interview preps",
        "QUERY_ERROR",
        error
      );
    }
  }

  async update(
    id: string,
    data: UpdateInterviewPrepInput
  ): Promise<InterviewPrep | null> {
    try {
      const supabase = await createClient();
      const { data: updatedPrep, error } = await supabase
        .from("interview_prep")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to update interview prep: ${error.message}`,
          "UPDATE_ERROR"
        );
      }

      return updatedPrep;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to update interview prep",
        "UPDATE_ERROR",
        error
      );
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("interview_prep")
        .delete()
        .eq("id", id);

      if (error) {
        throw new DALError(
          `Failed to delete interview prep: ${error.message}`,
          "DELETE_ERROR"
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to delete interview prep",
        "DELETE_ERROR",
        error
      );
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("interview_prep")
        .select("id")
        .eq("id", id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new DALError(
          `Failed to check interview prep existence: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return !!data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to check interview prep existence",
        "QUERY_ERROR",
        error
      );
    }
  }

  async count(userId?: string): Promise<number> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from("interview_prep")
        .select("id", { count: "exact", head: true });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { count, error } = await query;

      if (error) {
        throw new DALError(
          `Failed to count interview preps: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return count || 0;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to count interview preps",
        "QUERY_ERROR",
        error
      );
    }
  }

  async findExistingAnalysis({
    user_id,
    user_resume_id,
    resume_text,
    job_description,
    job_url,
    user_background,
  }: {
    user_id: string;
    user_resume_id?: string;
    resume_text?: string;
    job_description?: string;
    job_url?: string;
    user_background?: string;
  }): Promise<InterviewPrep | null> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from("interview_prep")
        .select("*")
        .eq("user_id", user_id);

      // Priority 1: user_resume_id + job_url + user_background
      if (user_resume_id && job_url && user_background) {
        query = query
          .eq("user_resume_id", user_resume_id)
          .eq("job_url", job_url)
          .eq("user_background", user_background);
      }
      // Priority 2: user_resume_id + job_description + user_background
      else if (user_resume_id && job_description && user_background) {
        query = query
          .eq("user_resume_id", user_resume_id)
          .eq("job_description", job_description)
          .eq("user_background", user_background);
      }
      // Priority 3: resume_text + job_url + user_background
      else if (resume_text && job_url && user_background) {
        query = query
          .eq("resume_text", resume_text)
          .eq("job_url", job_url)
          .eq("user_background", user_background);
      }
      // Priority 4: resume_text + job_description + user_background
      else if (resume_text && job_description && user_background) {
        query = query
          .eq("resume_text", resume_text)
          .eq("job_description", job_description)
          .eq("user_background", user_background);
      }
      // Fallback: just user_resume_id/job_url/job_description/user_background
      else {
        if (user_resume_id) query = query.eq("user_resume_id", user_resume_id);
        else if (resume_text) query = query.eq("resume_text", resume_text);
        if (job_description)
          query = query.eq("job_description", job_description);
        else if (job_url) query = query.eq("job_url", job_url);
        if (user_background)
          query = query.eq("user_background", user_background);
      }

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) {
        throw new DALError(
          `Failed to find existing interview prep: ${error.message}`,
          "QUERY_ERROR"
        );
      }
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to find existing interview prep",
        "QUERY_ERROR",
        error
      );
    }
  }
}

export class CareerAdviceDAL
  implements
    BaseDAL<CareerAdvice, CreateCareerAdviceInput, UpdateCareerAdviceInput>
{
  async create(data: CreateCareerAdviceInput): Promise<CareerAdvice> {
    try {
      const supabase = await createClient();
      const { data: advice, error } = await supabase
        .from("career_advice")
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new ValidationError(
          `Failed to create career advice: ${error.message}`
        );
      }

      return advice;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to create career advice",
        "CREATE_ERROR",
        error
      );
    }
  }

  async findById(id: string): Promise<CareerAdvice | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("career_advice")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to find career advice: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find career advice", "QUERY_ERROR", error);
    }
  }

  async findByUserId(userId: string): Promise<CareerAdvice[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("career_advice")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new DALError(
          `Failed to find career advice: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find career advice", "QUERY_ERROR", error);
    }
  }

  async update(
    id: string,
    data: UpdateCareerAdviceInput
  ): Promise<CareerAdvice | null> {
    try {
      const supabase = await createClient();
      const { data: updatedAdvice, error } = await supabase
        .from("career_advice")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to update career advice: ${error.message}`,
          "UPDATE_ERROR"
        );
      }

      return updatedAdvice;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to update career advice",
        "UPDATE_ERROR",
        error
      );
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("career_advice")
        .delete()
        .eq("id", id);

      if (error) {
        throw new DALError(
          `Failed to delete career advice: ${error.message}`,
          "DELETE_ERROR"
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to delete career advice",
        "DELETE_ERROR",
        error
      );
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("career_advice")
        .select("id")
        .eq("id", id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new DALError(
          `Failed to check career advice existence: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return !!data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to check career advice existence",
        "QUERY_ERROR",
        error
      );
    }
  }

  async count(userId?: string): Promise<number> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from("career_advice")
        .select("id", { count: "exact", head: true });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { count, error } = await query;

      if (error) {
        throw new DALError(
          `Failed to count career advice: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return count || 0;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to count career advice", "QUERY_ERROR", error);
    }
  }
}

export class CoverLetterDAL
  implements
    BaseDAL<CoverLetter, CreateCoverLetterInput, UpdateCoverLetterInput>
{
  async create(data: CreateCoverLetterInput): Promise<CoverLetter> {
    try {
      const supabase = await createClient();
      const { data: coverLetter, error } = await supabase
        .from("cover_letters")
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new ValidationError(
          `Failed to create cover letter: ${error.message}`
        );
      }

      return coverLetter;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to create cover letter",
        "CREATE_ERROR",
        error
      );
    }
  }

  async findById(id: string): Promise<CoverLetter | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("cover_letters")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to find cover letter: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find cover letter", "QUERY_ERROR", error);
    }
  }

  async findByUserId(userId: string): Promise<CoverLetter[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("cover_letters")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new DALError(
          `Failed to find cover letters: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find cover letters", "QUERY_ERROR", error);
    }
  }

  async update(
    id: string,
    data: UpdateCoverLetterInput
  ): Promise<CoverLetter | null> {
    try {
      const supabase = await createClient();
      const { data: updatedCoverLetter, error } = await supabase
        .from("cover_letters")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to update cover letter: ${error.message}`,
          "UPDATE_ERROR"
        );
      }

      return updatedCoverLetter;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to update cover letter",
        "UPDATE_ERROR",
        error
      );
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("cover_letters")
        .delete()
        .eq("id", id);

      if (error) {
        throw new DALError(
          `Failed to delete cover letter: ${error.message}`,
          "DELETE_ERROR"
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to delete cover letter",
        "DELETE_ERROR",
        error
      );
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("cover_letters")
        .select("id")
        .eq("id", id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new DALError(
          `Failed to check cover letter existence: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return !!data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to check cover letter existence",
        "QUERY_ERROR",
        error
      );
    }
  }

  async count(userId?: string): Promise<number> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from("cover_letters")
        .select("id", { count: "exact", head: true });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { count, error } = await query;

      if (error) {
        throw new DALError(
          `Failed to count cover letters: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return count || 0;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to count cover letters", "QUERY_ERROR", error);
    }
  }
}

export class JobFitAnalysisDAL
  implements
    BaseDAL<
      JobFitAnalysis,
      CreateJobFitAnalysisInput,
      UpdateJobFitAnalysisInput
    >
{
  async create(data: CreateJobFitAnalysisInput): Promise<JobFitAnalysis> {
    try {
      const supabase = await createClient();
      const { data: analysis, error } = await supabase
        .from("job_fit_analysis")
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new ValidationError(
          `Failed to create job fit analysis: ${error.message}`
        );
      }

      return analysis;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to create job fit analysis",
        "CREATE_ERROR",
        error
      );
    }
  }

  async findById(id: string): Promise<JobFitAnalysis | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("job_fit_analysis")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to find job fit analysis: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to find job fit analysis",
        "QUERY_ERROR",
        error
      );
    }
  }

  async findByUserId(userId: string): Promise<JobFitAnalysis[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("job_fit_analysis")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new DALError(
          `Failed to find job fit analyses: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to find job fit analyses",
        "QUERY_ERROR",
        error
      );
    }
  }

  async update(
    id: string,
    data: UpdateJobFitAnalysisInput
  ): Promise<JobFitAnalysis | null> {
    try {
      const supabase = await createClient();
      const { data: updatedAnalysis, error } = await supabase
        .from("job_fit_analysis")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to update job fit analysis: ${error.message}`,
          "UPDATE_ERROR"
        );
      }

      return updatedAnalysis;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to update job fit analysis",
        "UPDATE_ERROR",
        error
      );
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("job_fit_analysis")
        .delete()
        .eq("id", id);

      if (error) {
        throw new DALError(
          `Failed to delete job fit analysis: ${error.message}`,
          "DELETE_ERROR"
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to delete job fit analysis",
        "DELETE_ERROR",
        error
      );
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("job_fit_analysis")
        .select("id")
        .eq("id", id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new DALError(
          `Failed to check job fit analysis existence: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return !!data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to check job fit analysis existence",
        "QUERY_ERROR",
        error
      );
    }
  }

  async count(userId?: string): Promise<number> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from("job_fit_analysis")
        .select("id", { count: "exact", head: true });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { count, error } = await query;

      if (error) {
        throw new DALError(
          `Failed to count job fit analyses: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return count || 0;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to count job fit analyses",
        "QUERY_ERROR",
        error
      );
    }
  }
}
