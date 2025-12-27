"use server";

import { createClient } from "../supabase/server";
import { revalidatePath } from "next/cache";
import { applicationSchema, linkedinProfileSchema } from "./schemas";

// Application actions
export async function addApplicationAction(formData: FormData) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const rawData = {
      company: formData.get("company") as string,
      role: formData.get("role") as string,
      role_link: formData.get("role_link") as string,
      job_description: formData.get("job_description") as string,
      date_applied: formData.get("date_applied") as string,
      status: formData.get("status") as string,
    };

    const result = applicationSchema.safeParse(rawData);

    if (!result.success) {
      return {
        error: result.error.errors[0].message,
      };
    }

    const { error } = await supabase.from("applications").insert({
      user_id: user.id,
      ...result.data,
      role_link: result.data.role_link || null,
      job_description: result.data.job_description || null,
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return {
      error: "An unexpected error occurred while adding the application",
    };
  }
}

export async function updateApplicationAction(
  applicationId: string,
  formData: FormData
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const rawData = {
      company: formData.get("company") as string,
      role: formData.get("role") as string,
      role_link: formData.get("role_link") as string,
      job_description: formData.get("job_description") as string,
      date_applied: formData.get("date_applied") as string,
      status: formData.get("status") as string,
    };

    const result = applicationSchema.safeParse(rawData);

    if (!result.success) {
      return {
        error: result.error.errors[0].message,
      };
    }

    const { error } = await supabase
      .from("applications")
      .update({
        ...result.data,
        role_link: result.data.role_link || null,
        job_description: result.data.job_description || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .eq("user_id", user.id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return {
      error: "An unexpected error occurred while updating the application",
    };
  }
}

export async function addLinkedinProfileAction(
  applicationId: string,
  formData: FormData
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const rawData = {
      profile_url: formData.get("profile_url") as string,
      name: formData.get("name") as string,
      title: formData.get("title") as string,
    };

    const result = linkedinProfileSchema.safeParse(rawData);

    if (!result.success) {
      return {
        error: result.error.errors[0].message,
      };
    }

    // Verify the application belongs to the user
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single();

    if (appError || !application) {
      return { error: "Application not found" };
    }

    const { error } = await supabase.from("linkedin_profiles").insert({
      application_id: applicationId,
      ...result.data,
    });

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return {
      error: "An unexpected error occurred while adding the LinkedIn profile",
    };
  }
}

export async function deleteLinkedinProfileAction(
  profileId: string,
  applicationId: string
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Verify the application belongs to the user
    const { data: application, error: appError } = await supabase
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single();

    if (appError || !application) {
      return { error: "Application not found" };
    }

    const { error } = await supabase
      .from("linkedin_profiles")
      .delete()
      .eq("id", profileId)
      .eq("application_id", applicationId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return {
      error: "An unexpected error occurred while deleting the LinkedIn profile",
    };
  }
}

export async function archiveApplicationAction(applicationId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("applications")
      .update({
        archived: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .eq("user_id", user.id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return {
      error: "An unexpected error occurred while archiving the application",
    };
  }
}

export async function unarchiveApplicationAction(applicationId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("applications")
      .update({
        archived: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", applicationId)
      .eq("user_id", user.id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return {
      error: "An unexpected error occurred while unarchiving the application",
    };
  }
}

export async function deleteApplicationAction(applicationId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("applications")
      .delete()
      .eq("id", applicationId)
      .eq("user_id", user.id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    return {
      error: "An unexpected error occurred while deleting the application",
    };
  }
}
