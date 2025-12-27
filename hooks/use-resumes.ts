import { useState, useCallback } from "react";
import { ResumeService } from "@/services/resumes";
import type { UserResume, CreateResumeInput, UpdateResumeInput } from "@/types";

export function useResumes(userId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resumeService = new ResumeService();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const createResume = useCallback(
    async (data: CreateResumeInput): Promise<UserResume | null> => {
      if (!userId) {
        setError("User not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await resumeService.create({
          ...data,
          user_id: userId,
        });
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create resume";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId, resumeService]
  );

  const getResumes = useCallback(async (): Promise<UserResume[]> => {
    if (!userId) {
      setError("User not authenticated");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      return await resumeService.findByUserId(userId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get resumes";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId, resumeService]);

  const getCurrentResume = useCallback(async (): Promise<UserResume | null> => {
    if (!userId) {
      setError("User not authenticated");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      return await resumeService.findCurrentByUserId(userId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get current resume";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, resumeService]);

  const updateResume = useCallback(
    async (id: string, data: UpdateResumeInput): Promise<UserResume | null> => {
      if (!userId) {
        setError("User not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await resumeService.update(id, data);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update resume";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId, resumeService]
  );

  const upsertResume = useCallback(
    async (data: CreateResumeInput): Promise<UserResume | null> => {
      if (!userId) {
        setError("User not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await resumeService.upsertByUserId(userId, data);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to upsert resume";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId, resumeService]
  );

  const deleteResume = useCallback(
    async (id: string): Promise<boolean> => {
      if (!userId) {
        setError("User not authenticated");
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await resumeService.delete(id);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete resume";
        setError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [userId, resumeService]
  );

  const hasResume = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      setError("User not authenticated");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      return await resumeService.hasResume(userId);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to check if user has resume";
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [userId, resumeService]);

  const getResumeText = useCallback(async (): Promise<string | null> => {
    if (!userId) {
      setError("User not authenticated");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      return await resumeService.getResumeText(userId);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get resume text";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, resumeService]);

  return {
    loading,
    error,
    clearError,
    createResume,
    getResumes,
    getCurrentResume,
    updateResume,
    upsertResume,
    deleteResume,
    hasResume,
    getResumeText,
  };
}
