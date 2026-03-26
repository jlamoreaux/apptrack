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
 * Capture a server-side PostHog event and flush immediately.
 * Returns a Promise — wrap in after() in route handlers so Vercel
 * keeps the lambda alive until the HTTP request to PostHog completes.
 */
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
