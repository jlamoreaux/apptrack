import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      loggerService.error("Error updating password", error, {
        category: LogCategory.AUTH,
        action: "reset_password_error",
        metadata: { errorMessage: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    loggerService.error("Error in reset-password", error, {
      category: LogCategory.API,
      action: "reset_password_exception",
    });
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
