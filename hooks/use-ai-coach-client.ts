import { useState, useCallback } from "react";
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
        const response = await fetch("/api/ai-coach/resume-analysis/history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            resumeUrl,
            analysisResult,
          }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to create resume analysis");
        }

        const { analysis } = await response.json();
        return analysis;
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
      const response = await fetch("/api/ai-coach/resume-analysis/history", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to get resume analyses");
      }

      const { analyses } = await response.json();
      return analyses || [];
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
        const response = await fetch("/api/ai-coach/interview-prep/history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            jobDescription,
            prepContent,
          }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to create interview prep");
        }

        const { prep } = await response.json();
        return prep;
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
      const response = await fetch("/api/ai-coach/interview-prep/history", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to get interview preps");
      }

      const { preps } = await response.json();
      return preps || [];
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
        const response = await fetch("/api/ai-coach/career-advice/history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            question,
            advice,
          }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to create career advice");
        }

        const { advice: savedAdvice } = await response.json();
        return savedAdvice;
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
      const response = await fetch("/api/ai-coach/career-advice/history", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to get career advice");
      }

      const { advice } = await response.json();
      return advice || [];
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
        const response = await fetch("/api/ai-coach/cover-letters/history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            jobDescription,
            coverLetter,
          }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to create cover letter");
        }

        const { letter } = await response.json();
        return letter;
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
      const response = await fetch("/api/ai-coach/cover-letters/history", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to get cover letters");
      }

      const { coverLetters } = await response.json();
      return coverLetters || [];
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
        const response = await fetch("/api/ai-coach/job-fit-analysis/history", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            jobDescription,
            analysisResult,
            fitScore,
          }),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to create job fit analysis");
        }

        const { analysis } = await response.json();
        return analysis;
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
      const response = await fetch("/api/ai-coach/job-fit-analysis/history", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to get job fit analyses");
      }

      const { analyses } = await response.json();
      return analyses || [];
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
