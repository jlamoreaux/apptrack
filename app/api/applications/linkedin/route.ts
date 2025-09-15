import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

const LinkedInProfileSchema = z.object({
  linkedin_url: z.string().url("Must be a valid LinkedIn URL"),
  profile_data: z.object({}).optional(),
});

export async function GET() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();

    // Get LinkedIn profiles
    const { data: profiles, error } = await supabase
      .from("linkedin_profiles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching LinkedIn profiles:", error);
      return NextResponse.json({ error: "Failed to fetch LinkedIn profiles" }, { status: 500 });
    }

    return NextResponse.json({ profiles });

  } catch (error) {
    console.error("LinkedIn profiles GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = LinkedInProfileSchema.parse(body);

    const supabase = createServerSupabaseClient();

    // Insert LinkedIn profile
    const { data: profile, error } = await supabase
      .from("linkedin_profiles")
      .insert([
        {
          ...validatedData,
          user_id: user.id,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Error creating LinkedIn profile:", error);
      return NextResponse.json({ error: "Failed to create LinkedIn profile" }, { status: 500 });
    }

    return NextResponse.json({ profile }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("LinkedIn profiles POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("id");

    if (!profileId) {
      return NextResponse.json({ error: "Profile ID is required" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Delete LinkedIn profile (verify ownership)
    const { error } = await supabase
      .from("linkedin_profiles")
      .delete()
      .eq("id", profileId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting LinkedIn profile:", error);
      return NextResponse.json({ error: "Failed to delete LinkedIn profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("LinkedIn profiles DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}