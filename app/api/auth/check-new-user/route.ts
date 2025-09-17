import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { isNewUser } from "@/lib/utils/user-onboarding";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }
    
    const needsOnboarding = await isNewUser(userId);
    
    return NextResponse.json({ needsOnboarding });
  } catch (error) {
    console.error("Error checking new user status:", error);
    return NextResponse.json(
      { error: "Failed to check user status" },
      { status: 500 }
    );
  }
}