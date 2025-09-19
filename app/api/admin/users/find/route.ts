import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

// GET /api/admin/users/find - Find a user by email
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    if (!(await AdminService.isAdmin(user.id))) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // First try to find in profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("email", email.toLowerCase())
      .single();

    if (profile) {
      return NextResponse.json({ 
        userId: profile.id,
        email: profile.email,
        fullName: profile.full_name
      });
    }

    // If not in profiles, we can't add them as admin
    // They need to have logged in at least once
    return NextResponse.json(
      { error: "User not found. They must have logged in at least once." },
      { status: 404 }
    );
  } catch (error) {
    console.error("Error finding user:", error);
    return NextResponse.json(
      { error: "Failed to find user" },
      { status: 500 }
    );
  }
}