import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    
    // Fetch the roast by shareable_id
    const { data: roast, error } = await supabase
      .from("roasts")
      .select("*")
      .eq("shareable_id", id)
      .single();
    
    if (error || !roast) {
      return NextResponse.json(
        { error: "Roast not found" },
        { status: 404 }
      );
    }
    
    // Check if roast has expired
    if (new Date(roast.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This roast has expired" },
        { status: 410 } // Gone
      );
    }
    
    // Increment view count (fire and forget)
    void supabase
      .from("roasts")
      .update({ view_count: (roast.view_count || 0) + 1 })
      .eq("shareable_id", id);
    
    return NextResponse.json({
      content: roast.content,
      score: roast.score,
      scoreLabel: roast.score_label,
      firstName: roast.first_name,
      categories: roast.roast_categories,
      createdAt: roast.created_at,
      viewCount: roast.view_count || 0,
    });
    
  } catch (error) {
    console.error("Error fetching roast:", error);
    return NextResponse.json(
      { error: "Failed to fetch roast" },
      { status: 500 }
    );
  }
}