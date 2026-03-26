import { NextRequest, NextResponse, after } from "next/server"
import { createCallbackClient } from "@/lib/supabase/server-client";
import { handleOnSignup } from "@/lib/services/on-signup.service";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { captureServerEvent } from "@/lib/analytics/posthog-server";

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
    const { supabase, cookiesToSet } = createCallbackClient(request);
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
            loggerService.error('Post-signup setup failed in after() callback', err as Error, {
              category: LogCategory.AUTH,
              action: 'on_signup_after_callback_failed',
              userId: user.id,
            });
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

        // Route new signups (email confirmation) to the welcome page.
        // A user is "new" if their account was created in the last 5 minutes —
        // confirming an email that quickly means this is their first login.
        const isNewUser = (() => {
          const createdAt = user.created_at ? new Date(user.created_at).getTime() : 0;
          return Date.now() - createdAt < 5 * 60 * 1000;
        })();

        // Fire server-side signup event for new users.
        // Server-side capture ensures this fires even when the client
        // has PostHog blocked (ad blockers, strict browser privacy modes).
        if (isNewUser) {
          try {
            const provider = user.app_metadata?.provider ?? 'unknown';
            const utmCookie = request.cookies.get('apptrack_utm')?.value;
            const utm = utmCookie
              ? JSON.parse(decodeURIComponent(utmCookie)) as Record<string, string>
              : {};

            after(captureServerEvent(user.id, 'user_signed_up', {
              provider,
              email_domain: user.email?.split('@')[1] ?? null,
              utm_source: utm.utm_source ?? null,
              utm_medium: utm.utm_medium ?? null,
              utm_campaign: utm.utm_campaign ?? null,
              utm_term: utm.utm_term ?? null,
              utm_content: utm.utm_content ?? null,
              $set: {
                email_domain: user.email?.split('@')[1] ?? null,
                signup_provider: provider,
                utm_source: utm.utm_source ?? null,
              },
            }));
          } catch {
            // never block the auth flow
          }
        }

        const redirectPath = isValidInternalPath(next)
          ? next
          : isNewUser
            ? "/onboarding/welcome"
            : "/dashboard";
        const response = NextResponse.redirect(new URL(requestUrl.origin + redirectPath));
        // Apply session cookies to the redirect response so the browser
        // receives Set-Cookie headers alongside the 302.
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        return response;
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(
    new URL("/auth/error?message=Could not authenticate user", requestUrl.origin)
  );
}