import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

const DIFFERENTIATORS = [
  {
    title: "Rules, not transactions",
    body: "Define how your household handles money once. Expenses match a rule automatically — no re-picking splits every time.",
  },
  {
    title: "No signup required to participate",
    body: "Share an access link. Roommates and family can see balances and settle up without creating an account.",
  },
  {
    title: "Fair without nagging",
    body: "Faircutter shows what is owed — it does not send payment reminders or guilt-trip anyone. Humans nudge humans.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl text-center">
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Faircutter
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            Fair splits. Not just equal ones.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            A household money app built around rules, not transactions.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/auth"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              Sign in
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-11 items-center justify-center rounded-md border border-border px-6 text-sm font-medium transition hover:bg-muted"
            >
              Pricing
            </Link>
          </div>
        </div>

        <ul className="mt-20 grid max-w-3xl gap-8 text-left sm:grid-cols-3">
          {DIFFERENTIATORS.map((d) => (
            <li key={d.title} className="space-y-2">
              <h2 className="text-base font-semibold">{d.title}</h2>
              <p className="text-sm text-muted-foreground">{d.body}</p>
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
    </div>
  );
}
