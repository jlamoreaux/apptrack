import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { checkAICoachAccess } from "@/lib/middleware/ai-coach-auth";
import { z } from "zod";

const MessageSchema = z.object({
  content: z.string().min(1, "Message content is required"),
  is_user: z.boolean(),
});

export async function GET() {
  try {
    // Check authentication and AI Coach access
    const authResult = await checkAICoachAccess('CAREER_ADVICE');
    if (!authResult.authorized) {
      return authResult.response!;
    }

    const supabase = await createClient();
    const user = authResult.user;

    // Get conversation history
    const { data: messages, error } = await supabase
      .from("career_advice")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching career advice history:", error);
      return NextResponse.json({ error: "Failed to fetch conversation history" }, { status: 500 });
    }

    return NextResponse.json({ messages });

  } catch (error) {
    console.error("Career advice history GET error:", error);
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication and AI Coach access
    const authResult = await checkAICoachAccess('CAREER_ADVICE');
    if (!authResult.authorized) {
      return authResult.response!;
    }

    const supabase = await createClient();
    const user = authResult.user;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = MessageSchema.parse(body);

    // Insert message
    const { data: message, error } = await supabase
      .from("career_advice")
      .insert([
        {
          ...validatedData,
          user_id: user.id,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error("Error saving career advice message:", error);
      return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
    }

    return NextResponse.json({ message }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Career advice history POST error:", error);
    return NextResponse.json({ error: ERROR_MESSAGES.UNEXPECTED }, { status: 500 });
  }
}