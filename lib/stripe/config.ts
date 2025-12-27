export const STRIPE_API_VERSION = "2025-05-28.basil" as const;

export const STRIPE_CONFIG = {
  currency: "usd",
  // Note: Price IDs are now stored in the database (subscription_plans table)
  // This config is kept for backward compatibility but price IDs are fetched from DB
};
