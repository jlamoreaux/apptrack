import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get the current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error("Error checking session:", error);
      return NextResponse.json({ 
        authenticated: false,
        error: error.message 
      });
    }
    
    if (session && session.user) {
      return NextResponse.json({ 
        authenticated: true,
        user: {
          id: session.user.id,
          email: session.user.email,
          emailConfirmed: session.user.email_confirmed_at !== null
        }
      });
    }
    
    return NextResponse.json({ 
      authenticated: false 
    });
  } catch (error) {
    console.error("Error in check-session:", error);
    return NextResponse.json(
      { authenticated: false, error: "Failed to check session" },
      { status: 500 }
    );
  }
}