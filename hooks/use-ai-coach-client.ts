import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type {
  ResumeAnalysis,
  InterviewPrep,
  CareerAdvice,
  CoverLetter,
  JobFitAnalysis,
} from "@/types";

export function useAICoachClient(userId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const createResumeAnalysis = useCallback(
    async (
      resumeUrl: string,
      analysisResult: string
    ): Promise<ResumeAnalysis | null> => {
      if (!userId) {
        setError("User not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: supabaseError } = await supabase
          .from("resume_analysis")
          .insert({
            user_id: userId,
            resume_url: resumeUrl,
            analysis_result: analysisResult,
          })
          .select()
          .single();

        if (supabaseError) {
          throw new Error(supabaseError.message);
        }

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to create resume analysis";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const getResumeAnalyses = useCallback(async (): Promise<ResumeAnalysis[]> => {
    if (!userId) {
      setError("User not authenticated");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase
        .from("resume_analysis")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      return data || [];
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get resume analyses";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const createInterviewPrep = useCallback(
    async (
      jobDescription: string,
      prepContent: string
    ): Promise<InterviewPrep | null> => {
      if (!userId) {
        setError("User not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: supabaseError } = await supabase
          .from("interview_prep")
          .insert({
            user_id: userId,
            job_description: jobDescription,
            prep_content: prepContent,
          })
          .select()
          .single();

        if (supabaseError) {
          throw new Error(supabaseError.message);
        }

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to create interview prep";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const getInterviewPreps = useCallback(async (): Promise<InterviewPrep[]> => {
    if (!userId) {
      setError("User not authenticated");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase
        .from("interview_prep")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      return data || [];
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get interview preps";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const createCareerAdvice = useCallback(
    async (question: string, advice: string): Promise<CareerAdvice | null> => {
      if (!userId) {
        setError("User not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: supabaseError } = await supabase
          .from("career_advice")
          .insert({
            user_id: userId,
            question,
            advice,
          })
          .select()
          .single();

        if (supabaseError) {
          throw new Error(supabaseError.message);
        }

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create career advice";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const getCareerAdvice = useCallback(async (): Promise<CareerAdvice[]> => {
    if (!userId) {
      setError("User not authenticated");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase
        .from("career_advice")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      return data || [];
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get career advice";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const createCoverLetter = useCallback(
    async (
      jobDescription: string,
      coverLetter: string
    ): Promise<CoverLetter | null> => {
      if (!userId) {
        setError("User not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: supabaseError } = await supabase
          .from("cover_letters")
          .insert({
            user_id: userId,
            job_description: jobDescription,
            cover_letter: coverLetter,
          })
          .select()
          .single();

        if (supabaseError) {
          throw new Error(supabaseError.message);
        }

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create cover letter";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const getCoverLetters = useCallback(async (): Promise<CoverLetter[]> => {
    if (!userId) {
      setError("User not authenticated");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase
        .from("cover_letters")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      return data || [];
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get cover letters";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const createJobFitAnalysis = useCallback(
    async (
      jobDescription: string,
      analysisResult: string,
      fitScore: number
    ): Promise<JobFitAnalysis | null> => {
      if (!userId) {
        setError("User not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const { data, error: supabaseError } = await supabase
          .from("job_fit_analysis")
          .insert({
            user_id: userId,
            job_description: jobDescription,
            analysis_result: analysisResult,
            fit_score: fitScore,
          })
          .select()
          .single();

        if (supabaseError) {
          throw new Error(supabaseError.message);
        }

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to create job fit analysis";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const getJobFitAnalyses = useCallback(async (): Promise<JobFitAnalysis[]> => {
    if (!userId) {
      setError("User not authenticated");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase
        .from("job_fit_analysis")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      return data || [];
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get job fit analyses";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    loading,
    error,
    clearError,
    createResumeAnalysis,
    getResumeAnalyses,
    createInterviewPrep,
    getInterviewPreps,
    createCareerAdvice,
    getCareerAdvice,
    createCoverLetter,
    getCoverLetters,
    createJobFitAnalysis,
    getJobFitAnalyses,
  };
}
