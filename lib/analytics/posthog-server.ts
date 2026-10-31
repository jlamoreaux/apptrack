import { after } from 'next/server';
import { PostHog } from 'posthog-node';

let _client: PostHog | null = null;

function getClient(): PostHog | null {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return null;
  if (!_client) {
    _client = new PostHog(apiKey, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _client;
}

/**
 * Evaluate a feature flag server-side for a given user.
 * Returns the flag value (boolean or string variant), or the fallback if
 * PostHog is unavailable. This avoids client-side flash of content.
 */
export async function getServerFeatureFlag(
  distinctId: string,
  flagName: string,
  fallback: boolean = false
): Promise<boolean> {
  // Dev override: NEXT_PUBLIC_FF_<FLAG_NAME>=true in .env
  // e.g. NEXT_PUBLIC_FF_DASHBOARD_UX_AUDIT_V1=true
  const envKey = `NEXT_PUBLIC_FF_${flagName.toUpperCase().replace(/-/g, "_")}`;
  const envVal = process.env[envKey];
  if (envVal === "true") return true;
  if (envVal === "false") return false;

  try {
    const client = getClient();
    if (!client) return fallback;
    const value = await client.isFeatureEnabled(flagName, distinctId);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Capture a server-side PostHog event and flush immediately.
 * Returns a Promise — wrap in after() in route handlers so Vercel
 * keeps the lambda alive until the HTTP request to PostHog completes.
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;
    client.capture({ distinctId, event, properties: properties ?? {} });
    await client.flush();
  } catch {
    // never throw
  }
}

/**
 * Runs `task` after the response is sent when called inside a request, so the platform
 * keeps the function alive until it finishes. Outside a request scope (scripts, tests
 * without the Next runtime) `after` throws, and the task runs immediately instead.
 */
function runAfterResponse(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task();
  }
}

/** Fire-and-forget variant of captureServerEvent for library code with no access to after(). */
export function captureServerEventAfterResponse(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): void {
  runAfterResponse(() => captureServerEvent(distinctId, event, properties));
}

/**
 * Send a server-side exception to PostHog Error Tracking (`$exception`, with stack).
 * Never throws.
 */
export async function captureServerException(
  error: unknown,
  distinctId?: string,
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    const client = getClient();
    if (!client) return;
    await client.captureExceptionImmediate(error, distinctId, {
      $process_person_profile: Boolean(distinctId),
      ...properties,
    });
  } catch {
    // never throw
  }
}

export function captureServerExceptionAfterResponse(
  error: unknown,
  distinctId?: string,
  properties?: Record<string, unknown>
): void {
  runAfterResponse(() => captureServerException(error, distinctId, properties));
}
