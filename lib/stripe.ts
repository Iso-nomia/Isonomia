import Stripe from "stripe";
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
});
export const ORIGIN = process.env.NEXT_PUBLIC_APP_URL!;
