import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
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
        const { data: resume, error: supabaseError } = await supabase
          .from("user_resumes")
          .insert({
            ...data,
            user_id: userId,
          })
          .select()
          .single();

        if (supabaseError) {
          throw new Error(supabaseError.message);
        }

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
      const { data, error: supabaseError } = await supabase
        .from("user_resumes")
        .select("*")
        .eq("user_id", userId)
        .order("uploaded_at", { ascending: false });

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      return data || [];
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
      setError("User not authenticated");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: supabaseError } = await supabase
        .from("user_resumes")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (supabaseError) {
        if (supabaseError.code === "PGRST116") {
          return null; // Not found
        }
        throw new Error(supabaseError.message);
      }

      return data;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to get current resume";
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
        const { data: updatedResume, error: supabaseError } = await supabase
          .from("user_resumes")
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select()
          .single();

        if (supabaseError) {
          if (supabaseError.code === "PGRST116") {
            return null; // Not found
          }
          throw new Error(supabaseError.message);
        }

        return updatedResume;
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
        const { data: resume, error: supabaseError } = await supabase
          .from("user_resumes")
          .upsert({
            ...data,
            user_id: userId,
            updated_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (supabaseError) {
          throw new Error(supabaseError.message);
        }

        return resume;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to upsert resume";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId]
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
        const { error: supabaseError } = await supabase
          .from("user_resumes")
          .delete()
          .eq("id", id);

        if (supabaseError) {
          throw new Error(supabaseError.message);
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
