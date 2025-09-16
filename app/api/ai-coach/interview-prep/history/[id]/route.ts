import { NextRequest, NextResponse } from "next/server";
import { getUser, createClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // First verify the prep belongs to the user
    const { data: prep, error: fetchError } = await supabase
      .from("interview_prep")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !prep) {
      return NextResponse.json({ error: "Interview prep not found" }, { status: 404 });
    }

    // Delete the prep
    const { error: deleteError } = await supabase
      .from("interview_prep")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error deleting interview prep:", deleteError);
      return NextResponse.json({ error: "Failed to delete interview prep" }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Interview prep DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: prep, error } = await supabase
      .from("interview_prep")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (error || !prep) {
      return NextResponse.json({ error: "Interview prep not found" }, { status: 404 });
    }

    return NextResponse.json({ prep });

  } catch (error) {
    console.error("Interview prep GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}