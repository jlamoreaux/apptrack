import { NextRequest, NextResponse } from "next/server";
import { getUser, createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: preps, error } = await supabase
      .from("interview_prep")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching interview preps:", error);
      return NextResponse.json({ error: "Failed to fetch interview preps" }, { status: 500 });
    }

    return NextResponse.json({ preps: preps || [] });

  } catch (error) {
    console.error("Interview prep history GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobDescription, prepContent } = await request.json();

    if (!jobDescription || !prepContent) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: prep, error } = await supabase
      .from("interview_prep")
      .insert({
        user_id: user.id,
        job_description: jobDescription,
        prep_content: prepContent,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating interview prep:", error);
      return NextResponse.json({ error: "Failed to create interview prep" }, { status: 500 });
    }

    return NextResponse.json({ prep });

  } catch (error) {
    console.error("Interview prep history POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}