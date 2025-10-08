import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET() {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    // Get the current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      loggerService.error('Error checking session', error, {
        category: LogCategory.AUTH,
        action: 'check_session_error'
      });
      return NextResponse.json({ 
        authenticated: false,
        error: error.message 
      });
    }
    
    if (session && session.user) {
      loggerService.debug('Session check successful', {
        category: LogCategory.AUTH,
        userId: session.user.id,
        action: 'check_session_success',
        duration: Date.now() - startTime,
        metadata: {
          emailConfirmed: session.user.email_confirmed_at !== null
        }
      });
      
      return NextResponse.json({ 
        authenticated: true,
        user: {
          id: session.user.id,
          email: session.user.email,
          emailConfirmed: session.user.email_confirmed_at !== null
        }
      });
    }
    
    loggerService.debug('No active session found', {
      category: LogCategory.AUTH,
      action: 'check_session_none',
      duration: Date.now() - startTime
    });
    
    return NextResponse.json({ 
      authenticated: false 
    });
  } catch (error) {
    loggerService.error('Error in check-session', error, {
      category: LogCategory.AUTH,
      action: 'check_session_fatal_error',
      duration: Date.now() - startTime
    });
    
    return NextResponse.json(
      { authenticated: false, error: "Failed to check session" },
      { status: 500 }
    );
  }
}