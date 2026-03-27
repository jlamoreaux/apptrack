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