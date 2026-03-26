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
