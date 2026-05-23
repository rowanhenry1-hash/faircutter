/**
 * Stripe server client. Paywall stays off until PAYWALL_ENABLED=true.
 */
import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export function isPaywallEnabled(): boolean {
  return process.env.PAYWALL_ENABLED === "true";
}

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) {
    client = new Stripe(key, {
      apiVersion: "2025-08-27.basil",
      typescript: true,
    });
  }
  return client;
}

export function getStripePriceIds() {
  return {
    fairMonthly: process.env.STRIPE_PRICE_FAIR_MONTHLY ?? "",
    tripPass: process.env.STRIPE_PRICE_TRIP_PASS ?? "",
  };
}
