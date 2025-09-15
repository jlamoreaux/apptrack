import { useState, useCallback } from "react";
import type { UserResume, CreateResumeInput, UpdateResumeInput } from "@/types";

export function useResumesClient(userId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const response = await fetch("/api/resumes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to create resume");
        }

        const { resume } = await response.json();
        return resume;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create resume";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const getResumes = useCallback(async (): Promise<UserResume[]> => {
    if (!userId) {
      setError("User not authenticated");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/resumes", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to get resumes");
      }

      const { resumes } = await response.json();
      return resumes || [];
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get resumes";
      setError(errorMessage);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const getCurrentResume = useCallback(async (): Promise<UserResume | null> => {
    if (!userId) {
      console.log("no user id");
      setError("User not authenticated");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      console.log("getting current resume", userId);
      const response = await fetch("/api/resumes/current", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log("no resume found");
          return null; // Not found
        }
        const result = await response.json();
        throw new Error(result.error || "Failed to get current resume");
      }

      const { resume } = await response.json();
      return resume;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get current resume";
      console.log("error getting current resume", errorMessage);
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const updateResume = useCallback(
    async (id: string, data: UpdateResumeInput): Promise<UserResume | null> => {
      if (!userId) {
        setError("User not authenticated");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/resumes/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          if (response.status === 404) {
            return null; // Not found
          }
          const result = await response.json();
          throw new Error(result.error || "Failed to update resume");
        }

        const { resume } = await response.json();
        return resume;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update resume";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId]
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
        // Try to get current resume first to decide between create or update
        const currentResume = await getCurrentResume();
        
        if (currentResume) {
          // Update existing resume
          return await updateResume(currentResume.id, data);
        } else {
          // Create new resume
          return await createResume(data);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to upsert resume";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId, getCurrentResume, updateResume, createResume]
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
        const response = await fetch(`/api/resumes/${id}`, {
          method: "DELETE",
          credentials: "include",
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || "Failed to delete resume");
        }

        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete resume";
        setError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const hasResume = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      setError("User not authenticated");
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const resume = await getCurrentResume();
      return !!resume;
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
  }, [userId, getCurrentResume]);

  const getResumeText = useCallback(async (): Promise<string | null> => {
    if (!userId) {
      setError("User not authenticated");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const resume = await getCurrentResume();
      return resume?.extracted_text || null;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get resume text";
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, getCurrentResume]);

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
