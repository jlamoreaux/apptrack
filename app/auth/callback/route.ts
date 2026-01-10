import { NextRequest, NextResponse, after } from "next/server"
import { createClient } from "@/lib/supabase/server";
import { handleOnSignup } from "@/lib/services/on-signup.service";

/**
 * Handles the auth callback after email confirmation.
 *
 * Exchanges the confirmation code for a session, triggers post-signup
 * setup (Stripe customer, Resend audience), and redirects to dashboard.
 *
 * @param request - The incoming request containing the auth code
 * @returns Redirect to dashboard or error page
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Schedule post-signup setup to run after response is sent
        // Uses Next.js 15 `after` API to ensure completion in serverless environments
        after(async () => {
          try {
            await handleOnSignup(user);
          } catch (err) {
            console.error("Failed to complete post-signup setup:", err);
          }
        });

        // Validate next param to prevent open redirect attacks
        const isValidInternalPath = (path: string | null): boolean => {
          if (!path || typeof path !== "string") return false;
          if (!path.startsWith("/")) return false;
          if (path.startsWith("//")) return false;
          if (path.includes("://")) return false;
          return true;
        };

        const redirectPath = isValidInternalPath(next) ? next : "/dashboard";
        return NextResponse.redirect(new URL(requestUrl.origin + redirectPath));
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(
    new URL("/auth/error?message=Could not authenticate user", requestUrl.origin)
  );
}