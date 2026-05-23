import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
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
    </main>
  );
}
