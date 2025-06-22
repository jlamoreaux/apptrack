export const STRIPE_API_VERSION = "2025-05-28.basil" as const;

export const STRIPE_CONFIG = {
  currency: "usd",
  plans: {
    pro_monthly: {
      priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
      amount: 200, // $2.00 in cents
    },
    pro_yearly: {
      priceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID!,
      amount: 2000, // $20.00 in cents (annual)
    },
  },
};
