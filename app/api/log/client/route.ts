import { NextRequest, NextResponse } from "next/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory, LogLevel } from "@/lib/services/logger.types";
import { getUser } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { level, message, metadata, category = LogCategory.CLIENT } = await request.json();
    
    // Get current user if available
    const user = await getUser();
    
    // Add user context to metadata
    const enrichedMetadata = {
      ...metadata,
      userId: user?.id,
      userEmail: user?.email,
      source: 'client'
    };
    
    // Log based on level
    switch (level) {
      case 'error':
        loggerService.error(message, new Error(message), {
          category,
          ...enrichedMetadata
        });
        break;
      case 'warn':
        loggerService.warn(message, {
          category,
          ...enrichedMetadata
        });
        break;
      case 'info':
        loggerService.info(message, {
          category,
          ...enrichedMetadata
        });
        break;
      case 'debug':
      default:
        loggerService.debug(message, {
          category,
          ...enrichedMetadata
        });
        break;
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    // Don't log errors about logging errors to avoid infinite loops
    console.error('Client logging error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}