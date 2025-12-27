import { createClient } from "@/lib/supabase/server";
import { BaseDAL, DALError, NotFoundError, ValidationError } from "../base";
import type { UserResume, CreateResumeInput, UpdateResumeInput } from "@/types";

export class ResumeDAL
  implements BaseDAL<UserResume, CreateResumeInput, UpdateResumeInput>
{
  async create(data: CreateResumeInput): Promise<UserResume> {
    try {
      const supabase = await createClient();
      const { data: resume, error } = await supabase
        .from("user_resumes")
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new ValidationError(`Failed to create resume: ${error.message}`);
      }

      return resume;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to create resume", "CREATE_ERROR", error);
    }
  }

  async findById(id: string): Promise<UserResume | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("user_resumes")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to find resume: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find resume", "QUERY_ERROR", error);
    }
  }

  async findByUserId(userId: string): Promise<UserResume[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("user_resumes")
        .select("*")
        .eq("user_id", userId);

      if (error) {
        throw new DALError(
          `Failed to find resumes: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find resumes", "QUERY_ERROR", error);
    }
  }

  async findCurrentByUserId(userId: string): Promise<UserResume | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("user_resumes")
        .select("*")
        .eq("user_id", userId)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new DALError(
          `Failed to find resume: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find resume", "QUERY_ERROR", error);
    }
  }

  async update(
    id: string,
    data: UpdateResumeInput
  ): Promise<UserResume | null> {
    try {
      const supabase = await createClient();
      const { data: updatedResume, error } = await supabase
        .from("user_resumes")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to update resume: ${error.message}`,
          "UPDATE_ERROR"
        );
      }

      return updatedResume;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to update resume", "UPDATE_ERROR", error);
    }
  }

  async upsertByUserId(
    userId: string,
    data: CreateResumeInput
  ): Promise<UserResume> {
    try {
      const supabase = await createClient();
      const { data: resume, error } = await supabase
        .from("user_resumes")
        .upsert(
          {
            ...data,
            user_id: userId,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id",
          }
        )
        .select()
        .single();

      if (error) {
        throw new ValidationError(`Failed to upsert resume: ${error.message}`);
      }

      return resume;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to upsert resume", "UPSERT_ERROR", error);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("user_resumes")
        .delete()
        .eq("id", id);

      if (error) {
        throw new DALError(
          `Failed to delete resume: ${error.message}`,
          "DELETE_ERROR"
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to delete resume", "DELETE_ERROR", error);
    }
  }

  async deleteByUserId(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("user_resumes")
        .delete()
        .eq("user_id", userId);

      if (error) {
        throw new DALError(
          `Failed to delete resume: ${error.message}`,
          "DELETE_ERROR"
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to delete resume", "DELETE_ERROR", error);
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("user_resumes")
        .select("id")
        .eq("id", id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new DALError(
          `Failed to check resume existence: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return !!data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to check resume existence",
        "QUERY_ERROR",
        error
      );
    }
  }

  async count(userId?: string): Promise<number> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from("user_resumes")
        .select("id", { count: "exact", head: true });

      if (userId) {
        query = query.eq("user_id", userId);
      }

      const { count, error } = await query;

      if (error) {
        throw new DALError(
          `Failed to count resumes: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return count || 0;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to count resumes", "QUERY_ERROR", error);
    }
  }
}
