import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function GET() {
  const startTime = Date.now();
  
  try {
    const supabase = await createClient();
    
    // First, try to refresh the session to ensure we have the latest state
    loggerService.debug('Attempting to refresh session', {
      category: LogCategory.AUTH,
      action: 'check_session_refresh_start'
    });
    
    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      loggerService.warn('Session refresh failed, falling back to getSession', {
        category: LogCategory.AUTH,
        action: 'check_session_refresh_failed',
        metadata: {
          error: refreshError.message
        }
      });
    } else {
      loggerService.debug('Session refresh successful', {
        category: LogCategory.AUTH,
        action: 'check_session_refresh_success',
        metadata: {
          hasSession: !!refreshedSession,
          userId: refreshedSession?.user?.id
        }
      });
    }
    
    // If refresh fails, fall back to getSession
    const { data: { session }, error } = refreshError 
      ? await supabase.auth.getSession()
      : { data: { session: refreshedSession }, error: null };
    
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