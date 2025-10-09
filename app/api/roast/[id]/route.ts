import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  
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
      loggerService.warn('Roast not found', {
        category: LogCategory.API,
        action: 'roast_get_not_found',
        duration: Date.now() - startTime,
        metadata: {
          roastId: id,
          error: error?.message
        }
      });
      return NextResponse.json(
        { error: "Roast not found" },
        { status: 404 }
      );
    }
    
    // Check if roast has expired
    if (new Date(roast.expires_at) < new Date()) {
      loggerService.info('Expired roast accessed', {
        category: LogCategory.BUSINESS,
        action: 'roast_get_expired',
        duration: Date.now() - startTime,
        metadata: {
          roastId: id,
          expiresAt: roast.expires_at,
          createdAt: roast.created_at
        }
      });
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
    
    loggerService.info('Roast retrieved successfully', {
      category: LogCategory.BUSINESS,
      action: 'roast_get_success',
      duration: Date.now() - startTime,
      metadata: {
        roastId: id,
        viewCount: roast.view_count || 0,
        userId: roast.user_id,
        isAuthenticated: !!roast.user_id
      }
    });
    
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
    loggerService.error('Error fetching roast', error, {
      category: LogCategory.API,
      action: 'roast_get_error',
      duration: Date.now() - startTime,
      metadata: {
        roastId: id
      }
    });
    return NextResponse.json(
      { error: "Failed to fetch roast" },
      { status: 500 }
    );
  }
}