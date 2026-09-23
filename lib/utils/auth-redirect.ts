/**
 * Carrying a post-auth destination through login, sign-up and onboarding.
 * The destination is always a site-relative path checked with
 * isValidInternalPath; anything else is dropped. Client-safe.
 */

import {
  APP_ROUTES,
  AUTH_REDIRECT_TO_PARAM,
  ONBOARDING_NEXT_PARAM,
} from "@/lib/constants/routes";
import { isValidInternalPath } from "@/lib/utils/internal-path";

/** A Next.js searchParams value, which repeats as an array. */
export type SearchParamValue = string | string[] | undefined;

/** The value when it's a single valid internal path, else null. */
export function validInternalPath(value: SearchParamValue | null): string | null {
  return isValidInternalPath(value) ? value : null;
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

/** Onboarding, returning to `next` when it finishes without checkout. */
export function onboardingHref(next: string): string {
  return withParam(APP_ROUTES.ONBOARDING_WELCOME, ONBOARDING_NEXT_PARAM, next);
}
