import { PublicPageShell } from "@/components/public-page-shell";

const LAST_UPDATED = "May 23, 2026";

export default function PrivacyPage() {
  return (
    <PublicPageShell narrow>
      <article className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
        <div>
          <h1 className="text-3xl font-semibold not-prose">Privacy Policy</h1>
          <p className="mt-2 text-muted-foreground not-prose">
            <strong>Draft</strong> — Last updated {LAST_UPDATED}. Not legal advice;
            we will tighten this before charging customers.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">What we collect</h2>
          <p className="text-muted-foreground">
            Account email and name; group and expense data you enter; optional
            declared income for split rules; magic-link and session tokens; basic
            server logs (IP, user agent) for security.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">What we do not collect</h2>
          <p className="text-muted-foreground">
            We do not connect to banks, read paystubs, or buy data from
            advertisers. We do not sell your personal information.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">How we use data</h2>
          <p className="text-muted-foreground">
            To run the product: calculate splits, show balances, send sign-in
            emails, and improve Faircutter. If you opt in to anonymous data
            sharing in Settings, we may use aggregated patterns — never your name
            or email in a sellable dataset.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Retention and deletion</h2>
          <p className="text-muted-foreground">
            You can request deletion of your account and associated data. Account
            self-delete from the app is coming soon; until then, contact us and
            we will process requests within a reasonable time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Processors</h2>
          <p className="text-muted-foreground">
            We use hosting (Vercel), database (Neon), email (Resend), and
            payment processing (Stripe, when enabled). Each has their own privacy
            policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            Questions: privacy@faircutter.com (placeholder — update before launch).
          </p>
        </section>
      </article>
    </PublicPageShell>
  );
}
