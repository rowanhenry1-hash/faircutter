import Link from "next/link";
import { PublicPageShell } from "@/components/public-page-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isPaywallEnabled } from "@/lib/stripe";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Everything Faircutter offers today — rules, groups, ghost invites, settlements.",
    features: [
      "Unlimited groups and expenses",
      "Full rules engine and templates",
      "No-signup ghost invites",
      "Pairwise balances and settlements",
    ],
    cta: "Get started",
    href: "/auth",
    highlighted: false,
  },
  {
    name: "Fair",
    price: "$5",
    period: "/ month",
    description:
      "Supports development. Unlocks anything we paywall later — same product, sustainable pricing.",
    features: [
      "Everything in Free",
      "Priority when we add premium features",
      "Helps keep Faircutter ad-free",
    ],
    cta: "Subscribe",
    disabled: true,
    highlighted: true,
  },
  {
    name: "Trip Pass",
    price: "$4",
    period: "one-time",
    description:
      "A multi-month trip or short-term group without a subscription. Great for vacations.",
    features: [
      "Everything in Free for one trip group",
      "Valid for the life of that group",
      "No recurring charge",
    ],
    cta: "Buy pass",
    disabled: true,
    highlighted: false,
  },
] as const;

export default function PricingPage() {
  const paywallOn = isPaywallEnabled();

  return (
    <PublicPageShell>
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold">Pricing</h1>
          <p className="mt-2 text-muted-foreground">
            Faircutter is free while we finish the launch. Paid tiers are listed
            so you know what&apos;s coming — nothing is charged yet.
          </p>
          {!paywallOn ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Subscriptions are disabled until we flip the paywall on.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {TIERS.map((tier) => (
            <Card
              key={tier.name}
              className={
                tier.highlighted ? "border-primary shadow-sm" : undefined
              }
            >
              <CardHeader>
                <CardTitle>{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
                <p className="pt-2 text-3xl font-semibold">
                  {tier.price}
                  <span className="text-base font-normal text-muted-foreground">
                    {" "}
                    {tier.period}
                  </span>
                </p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {tier.features.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {"href" in tier && tier.href ? (
                  <Button asChild className="w-full">
                    <Link href={tier.href}>{tier.cta}</Link>
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={"disabled" in tier && tier.disabled}
                    title="Coming soon"
                  >
                    {tier.cta}
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
