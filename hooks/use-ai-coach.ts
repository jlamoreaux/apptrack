import { useState, useCallback } from "react";
import { AICoachService } from "@/services/ai-coach";
import type {
  ResumeAnalysis,
  InterviewPrep,
  CareerAdvice,
  CoverLetter,
  JobFitAnalysis,
} from "@/types";

export function useAICoach(userId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const aiCoachService = new AICoachService();

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
        const result = await aiCoachService.createResumeAnalysis(userId, {
          analysis_result: analysisResult,
        });
        return result;
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
    [userId, aiCoachService]
  );

  const getResumeAnalyses = useCallback(async (): Promise<ResumeAnalysis[]> => {
    if (!userId) {
      setError("User not authenticated");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      return await aiCoachService.getResumeAnalyses(userId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get resume analyses";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId, aiCoachService]);

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
        const result = await aiCoachService.createInterviewPrep({
          user_id: userId,
          job_description: jobDescription,
          prep_content: prepContent,
        });
        return result;
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
    [userId, aiCoachService]
  );

  const getInterviewPreps = useCallback(async (): Promise<InterviewPrep[]> => {
    if (!userId) {
      setError("User not authenticated");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      return await aiCoachService.getInterviewPreps(userId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get interview preps";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId, aiCoachService]);

  const createCareerAdvice = useCallback(
    async (question: string, advice: string): Promise<CareerAdvice | null> => {
      if (!userId) {
        setError("User not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await aiCoachService.createCareerAdvice(
          userId,
          question,
          advice
        );
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create career advice";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId, aiCoachService]
  );

  const getCareerAdvice = useCallback(async (): Promise<CareerAdvice[]> => {
    if (!userId) {
      setError("User not authenticated");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      return await aiCoachService.getCareerAdvice(userId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get career advice";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId, aiCoachService]);

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
        const result = await aiCoachService.createCoverLetter(
          userId,
          jobDescription,
          coverLetter
        );
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create cover letter";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId, aiCoachService]
  );

  const getCoverLetters = useCallback(async (): Promise<CoverLetter[]> => {
    if (!userId) {
      setError("User not authenticated");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      return await aiCoachService.getCoverLetters(userId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get cover letters";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId, aiCoachService]);

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
        const result = await aiCoachService.createJobFitAnalysis(
          userId,
          jobDescription,
          analysisResult,
          fitScore
        );
        return result;
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
    [userId, aiCoachService]
  );

  const getJobFitAnalyses = useCallback(async (): Promise<JobFitAnalysis[]> => {
    if (!userId) {
      setError("User not authenticated");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      return await aiCoachService.getJobFitAnalyses(userId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get job fit analyses";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId, aiCoachService]);

  const getAICoachUsageStats = useCallback(async () => {
    if (!userId) {
      setError("User not authenticated");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      return await aiCoachService.getAICoachUsageStats(userId);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to get AI Coach usage stats";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, aiCoachService]);

  const getRecentAICoachActivity = useCallback(
    async (limit: number = 10) => {
      if (!userId) {
        setError("User not authenticated");
        return [];
      }

      setLoading(true);
      setError(null);

      try {
        return await aiCoachService.getRecentAICoachActivity(userId, limit);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to get recent AI Coach activity";
        setError(errorMessage);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [userId, aiCoachService]
  );

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
    getAICoachUsageStats,
    getRecentAICoachActivity,
  };
}
