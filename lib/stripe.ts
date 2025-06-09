import Stripe from "stripe"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set")
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
})

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
}
