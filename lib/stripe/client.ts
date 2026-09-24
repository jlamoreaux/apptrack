import Stripe from "stripe";
import { STRIPE_API_VERSION } from "./config";

let client: Stripe | null = null;

function getStripeClient() {
  if (client) {
    return client;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  client = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
    // Stripe's default transport is Node's `http` module, which does not exist on
    // Cloudflare Workers. The fetch client works on both Node 18+ and Workers, so this
    // is safe to adopt before the migration rather than during it.
    httpClient: Stripe.createFetchHttpClient(),
  });

  return client;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripeClient();
    const value = client[prop as keyof Stripe];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});
/**
 * Verifies a Stripe webhook signature.
 *
 * Uses the async/WebCrypto path rather than `webhooks.constructEvent`, whose synchronous
 * Node crypto is unavailable on Cloudflare Workers. Behaviour is identical on Node 18+.
 *
 * Lives here rather than in the route because `Stripe` must be a *value* import to reach
 * `createSubtleCryptoProvider()` — the route imports it as `import type`, which is erased
 * at runtime.
 */
export async function constructWebhookEvent(
  body: string,
  signature: string,
  secret: string
): Promise<Stripe.Event> {
  return getStripeClient().webhooks.constructEventAsync(
    body,
    signature,
    secret,
    undefined,
    Stripe.createSubtleCryptoProvider()
  );
}
