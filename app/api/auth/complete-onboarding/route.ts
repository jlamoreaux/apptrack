import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { markOnboardingComplete } from "@/lib/utils/user-onboarding";

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    await markOnboardingComplete(user.id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking onboarding complete:", error);
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    );
  }
}