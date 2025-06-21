"use server";

import { createClient } from "../supabase";
import { redirect } from "next/navigation";
import { signUpSchema, signInSchema, profileUpdateSchema } from "./schemas";

// Auth actions
export async function signUpAction(formData: FormData) {
  try {
    const rawData = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const result = signUpSchema.safeParse(rawData);

    if (!result.success) {
      return {
        error: result.error.errors[0].message,
      };
    }

    const { name, email, password } = result.data;
    const supabase = await createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) {
      return {
        error: error.message,
      };
    }

    redirect("/dashboard");
  } catch (error) {
    console.error("Sign up error:", error);
    return { error: "An unexpected error occurred during sign up" };
  }
}

export async function signInAction(formData: FormData) {
  try {
    const rawData = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    const result = signInSchema.safeParse(rawData);

    if (!result.success) {
      return {
        error: result.error.errors[0].message,
      };
    }

    const { email, password } = result.data;
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        error: error.message,
      };
    }

    redirect("/dashboard");
  } catch (error) {
    console.error("Sign in error:", error);
    return { error: "An unexpected error occurred during sign in" };
  }
}

export async function signOutAction() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/");
  } catch (error) {
    console.error("Sign out error:", error);
    redirect("/");
  }
}

// Profile update action
export async function updateProfileAction(formData: FormData) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const rawData = {
      full_name: formData.get("full_name") as string,
    };

    const result = profileUpdateSchema.safeParse(rawData);

    if (!result.success) {
      return {
        error: result.error.errors[0].message,
      };
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: result.data.full_name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Profile update error:", error);
    return { error: "An unexpected error occurred during profile update" };
  }
}
