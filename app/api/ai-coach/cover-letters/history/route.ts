import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerSupabaseClient();

    const { data: coverLetters, error } = await supabase
      .from("cover_letters")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching cover letters:", error);
      return NextResponse.json({ error: "Failed to fetch cover letters" }, { status: 500 });
    }

    return NextResponse.json({ coverLetters: coverLetters || [] });

  } catch (error) {
    console.error("Cover letters history GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobDescription, coverLetter } = await request.json();

    if (!jobDescription || !coverLetter) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    const { data: letter, error } = await supabase
      .from("cover_letters")
      .insert({
        user_id: user.id,
        job_description: jobDescription,
        cover_letter: coverLetter,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating cover letter:", error);
      return NextResponse.json({ error: "Failed to create cover letter" }, { status: 500 });
    }

    return NextResponse.json({ letter });

  } catch (error) {
    console.error("Cover letters history POST error:", error);
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
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Cover letter ID is required" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from("cover_letters")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting cover letter:", error);
      return NextResponse.json({ error: "Failed to delete cover letter" }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Cover letters history DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}