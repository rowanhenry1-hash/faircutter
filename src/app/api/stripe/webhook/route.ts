import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook stub — verifies signature and logs events.
 * No billing side-effects until PAYWALL_ENABLED is flipped on.
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    console.warn(
      "[stripe/webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set — ignoring event",
    );
    return new Response("Webhook not configured", { status: 503 });
  }

  const body = await request.text();
  const headerList = await headers();
  const signature = headerList.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe/webhook] Signature verification failed:", message);
    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  console.info("[stripe/webhook] Received event", {
    id: event.id,
    type: event.type,
  });

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
