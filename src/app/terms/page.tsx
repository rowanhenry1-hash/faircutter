import { PublicPageShell } from "@/components/public-page-shell";

const LAST_UPDATED = "May 23, 2026";

export default function TermsPage() {
  return (
    <PublicPageShell narrow>
      <article className="space-y-6 text-sm leading-relaxed">
        <div>
          <h1 className="text-3xl font-semibold">Terms of Service</h1>
          <p className="mt-2 text-muted-foreground">
            <strong>Draft</strong> — Last updated {LAST_UPDATED}. Not legal advice;
            we will tighten this before charging customers.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">The service</h2>
          <p className="text-muted-foreground">
            Faircutter helps households and groups track shared expenses and apply
            split rules. We are not a bank, lender, or financial advisor. Splits
            are informational — you settle money between yourselves.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your responsibilities</h2>
          <p className="text-muted-foreground">
            You must provide accurate information, keep your account secure, and
            only add people to groups with their consent. Do not use Faircutter
            for illegal activity or harassment.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Payments</h2>
          <p className="text-muted-foreground">
            Paid plans may be offered later via Stripe. Prices and features will
            be shown before you are charged. Subscriptions can be cancelled per
            Stripe&apos;s billing flow when billing is live.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Disclaimer</h2>
          <p className="text-muted-foreground">
            Faircutter is provided &quot;as is&quot; without warranties. We are not
            liable for disputes between group members or errors in amounts you
            enter. Check important splits yourself.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Changes</h2>
          <p className="text-muted-foreground">
            We may update these terms. Continued use after changes means you
            accept the updated terms. Material changes will be noted on this page.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            Questions: legal@faircutter.com (placeholder — update before launch).
          </p>
        </section>
      </article>
    </PublicPageShell>
  );
}
