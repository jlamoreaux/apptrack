import { createClient } from "@/lib/supabase/server";
import { BaseDAL, DALError, NotFoundError, ValidationError } from "../base";
import type { User, Profile } from "@/types";

export interface CreateUserInput {
  email: string;
  password: string;
}

export interface UpdateUserInput {
  email?: string;
}

export interface CreateProfileInput {
  user_id: string;
  full_name?: string;
  avatar_url?: string;
}

export interface UpdateProfileInput {
  full_name?: string;
  avatar_url?: string;
}

export class UserDAL
  implements BaseDAL<User, CreateUserInput, UpdateUserInput>
{
  async create(data: CreateUserInput): Promise<User> {
    try {
      const supabase = await createClient();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        throw new ValidationError(
          `Failed to create user: ${authError.message}`
        );
      }

      if (!authData.user) {
        throw new ValidationError("User creation failed - no user returned");
      }

      return {
        id: authData.user.id,
        email: authData.user.email!,
        created_at: authData.user.created_at,
        updated_at: authData.user.updated_at!,
      };
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to create user", "CREATE_ERROR", error);
    }
  }

  async findById(id: string): Promise<User | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to find user: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find user", "QUERY_ERROR", error);
    }
  }

  async findByUserId(userId: string): Promise<User[]> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId);

      if (error) {
        throw new DALError(
          `Failed to find users: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data || [];
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to find users", "QUERY_ERROR", error);
    }
  }

  async update(id: string, data: UpdateUserInput): Promise<User | null> {
    try {
      const supabase = await createClient();
      const { data: updatedUser, error } = await supabase
        .from("users")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to update user: ${error.message}`,
          "UPDATE_ERROR"
        );
      }

      return updatedUser;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to update user", "UPDATE_ERROR", error);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { error } = await supabase.from("users").delete().eq("id", id);

      if (error) {
        throw new DALError(
          `Failed to delete user: ${error.message}`,
          "DELETE_ERROR"
        );
      }

      return true;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to delete user", "DELETE_ERROR", error);
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .eq("id", id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw new DALError(
          `Failed to check user existence: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return !!data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError(
        "Failed to check user existence",
        "QUERY_ERROR",
        error
      );
    }
  }

  async count(userId?: string): Promise<number> {
    try {
      const supabase = await createClient();
      let query = supabase
        .from("users")
        .select("id", { count: "exact", head: true });

      if (userId) {
        query = query.eq("id", userId);
      }

      const { count, error } = await query;

      if (error) {
        throw new DALError(
          `Failed to count users: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return count || 0;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to count users", "QUERY_ERROR", error);
    }
  }

  // Profile-specific methods
  async getProfile(userId: string): Promise<Profile | null> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to get profile: ${error.message}`,
          "QUERY_ERROR"
        );
      }

      return data;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to get profile", "QUERY_ERROR", error);
    }
  }

  async updateProfile(
    userId: string,
    data: UpdateProfileInput
  ): Promise<Profile | null> {
    try {
      const supabase = await createClient();
      const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .update(data)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new DALError(
          `Failed to update profile: ${error.message}`,
          "UPDATE_ERROR"
        );
      }

      return updatedProfile;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to update profile", "UPDATE_ERROR", error);
    }
  }

  async createProfile(data: CreateProfileInput): Promise<Profile> {
    try {
      const supabase = await createClient();
      const { data: profile, error } = await supabase
        .from("profiles")
        .insert(data)
        .select()
        .single();

      if (error) {
        throw new DALError(
          `Failed to create profile: ${error.message}`,
          "CREATE_ERROR"
        );
      }

      return profile;
    } catch (error) {
      if (error instanceof DALError) throw error;
      throw new DALError("Failed to create profile", "CREATE_ERROR", error);
    }
  }
}
