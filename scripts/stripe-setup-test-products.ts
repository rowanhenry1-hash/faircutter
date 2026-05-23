/**
 * One-time Stripe test-mode setup for Faircutter launch tiers.
 *
 * Creates (or reuses) products + prices:
 *   - Fair: $5/month recurring
 *   - Trip Pass: $4 one-time
 *
 * Usage:
 *   npx tsx scripts/stripe-setup-test-products.ts
 *
 * Requires STRIPE_SECRET_KEY in .env.local (sk_test_...).
 * Prints price IDs to paste into .env.local / Vercel, or pass --write-env to update .env.local.
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import Stripe from "stripe";

config({ path: ".env.local" });

const WRITE_ENV = process.argv.includes("--write-env");

const FAIR = {
  productName: "Faircutter Fair",
  productDescription: "Monthly subscription — supports Faircutter development.",
  lookupKey: "faircutter_fair_monthly",
  unitAmount: 500, // $5.00 USD
  interval: "month" as const,
};

const TRIP = {
  productName: "Faircutter Trip Pass",
  productDescription: "One-time pass for a trip or short-term group.",
  lookupKey: "faircutter_trip_pass",
  unitAmount: 400, // $4.00 USD
};

async function findPriceByLookup(
  stripe: Stripe,
  lookupKey: string,
): Promise<string | null> {
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  return prices.data[0]?.id ?? null;
}

async function ensureRecurringPrice(
  stripe: Stripe,
  spec: typeof FAIR,
): Promise<string> {
  const existing = await findPriceByLookup(stripe, spec.lookupKey);
  if (existing) {
    console.log(`Reusing price ${existing} (${spec.lookupKey})`);
    return existing;
  }

  const product = await stripe.products.create({
    name: spec.productName,
    description: spec.productDescription,
    metadata: { faircutter_tier: "fair" },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: spec.unitAmount,
    recurring: { interval: spec.interval },
    lookup_key: spec.lookupKey,
    transfer_lookup_key: true,
    metadata: { faircutter_tier: "fair" },
  });

  console.log(`Created Fair monthly price: ${price.id}`);
  return price.id;
}

async function ensureOneTimePrice(
  stripe: Stripe,
  spec: typeof TRIP,
): Promise<string> {
  const existing = await findPriceByLookup(stripe, spec.lookupKey);
  if (existing) {
    console.log(`Reusing price ${existing} (${spec.lookupKey})`);
    return existing;
  }

  const product = await stripe.products.create({
    name: spec.productName,
    description: spec.productDescription,
    metadata: { faircutter_tier: "trip_pass" },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: spec.unitAmount,
    lookup_key: spec.lookupKey,
    transfer_lookup_key: true,
    metadata: { faircutter_tier: "trip_pass" },
  });

  console.log(`Created Trip Pass price: ${price.id}`);
  return price.id;
}

function upsertEnvLocal(fairMonthly: string, tripPass: string) {
  const envPath = resolve(process.cwd(), ".env.local");
  let content = readFileSync(envPath, "utf8");

  const set = (key: string, value: string) => {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(content)) {
      content = content.replace(re, line);
    } else {
      content += `\n${line}`;
    }
  };

  set("STRIPE_PRICE_FAIR_MONTHLY", fairMonthly);
  set("STRIPE_PRICE_TRIP_PASS", tripPass);

  writeFileSync(envPath, content);
  console.log(`Updated ${envPath}`);
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith("sk_test_")) {
    console.error(
      "Set STRIPE_SECRET_KEY=sk_test_... in .env.local (test mode only for this script).",
    );
    process.exit(1);
  }

  const stripe = new Stripe(key, {
    apiVersion: "2025-08-27.basil",
  });

  const fairMonthly = await ensureRecurringPrice(stripe, FAIR);
  const tripPass = await ensureOneTimePrice(stripe, TRIP);

  console.log("\nAdd to .env.local and Vercel:\n");
  console.log(`STRIPE_PRICE_FAIR_MONTHLY=${fairMonthly}`);
  console.log(`STRIPE_PRICE_TRIP_PASS=${tripPass}`);
  console.log("\nPAYWALL_ENABLED should stay false until you are ready to charge.\n");

  if (WRITE_ENV) {
    upsertEnvLocal(fairMonthly, tripPass);
  } else {
    console.log("Run with --write-env to patch .env.local automatically.\n");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
