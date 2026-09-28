/**
 * Carrying a post-auth destination through login, sign-up and onboarding.
 * The destination is always a same-origin path, resolved with
 * safeInternalPath; anything else is dropped. Client-safe.
 */

import {
  APP_ROUTES,
  AUTH_CALLBACK_NEXT_PARAM,
  AUTH_CALLBACK_PATH,
  AUTH_REDIRECT_TO_PARAM,
  ONBOARDING_NEXT_PARAM,
} from "@/lib/constants/routes";
import { SITE_URL } from "@/lib/constants/site-config";
import { safeInternalPath } from "@/lib/utils/internal-path";
import type { SearchParamValue } from "@/types";

/**
 * The origin redirect targets are resolved against: the page's own origin in
 * the browser, SITE_URL on the server.
 */
export function redirectOrigin(): string {
  return typeof window === "undefined" ? SITE_URL : window.location.origin;
}

/**
 * The value when it's a single same-origin path, as the URL parser resolved
 * it against `origin` (see safeInternalPath), else null. Navigate to the
 * result, never to the raw value.
 */
export function validInternalPath(
  value: SearchParamValue | null,
  origin: string = redirectOrigin()
): string | null {
  return safeInternalPath(value, origin);
}

function withParam(base: string, name: string, path: string | null): string {
  if (path === null) return base;
  return `${base}?${name}=${encodeURIComponent(path)}`;
}

/** /login, carrying `redirectTo` when there is one. */
export function loginHref(redirectTo: string | null): string {
  return withParam(APP_ROUTES.LOGIN, AUTH_REDIRECT_TO_PARAM, redirectTo);
}

/** /signup, carrying `redirectTo` when there is one. */
export function signupHref(redirectTo: string | null): string {
  return withParam(APP_ROUTES.SIGNUP, AUTH_REDIRECT_TO_PARAM, redirectTo);
}

/**
 * The auth callback on `origin`, continuing to `next` when there is one: the
 * Google sign-in redirect and the sign-up confirmation email's link.
 */
export function authCallbackUrl(origin: string, next: string | null): string {
  return `${origin}${withParam(AUTH_CALLBACK_PATH, AUTH_CALLBACK_NEXT_PARAM, next)}`;
}

/** Onboarding, returning to `next` when it finishes without checkout. */
export function onboardingHref(next: string): string {
  return withParam(APP_ROUTES.ONBOARDING_WELCOME, ONBOARDING_NEXT_PARAM, next);
}
