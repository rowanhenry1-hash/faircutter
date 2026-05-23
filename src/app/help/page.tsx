import { PublicPageShell } from "@/components/public-page-shell";

const FAQ = [
  {
    q: "How do rules work?",
    a: "You define how your household handles money once — by income, equal split, fixed amounts, exceptions, and more. When you add an expense, Faircutter picks the matching rule and calculates each person's share automatically.",
  },
  {
    q: "Can I use Faircutter without creating an account?",
    a: "Yes. People you add as members get a one-time access link. They can view their balance, see how rules applied, and record settlements without signing up. They can create an account later to keep history.",
  },
  {
    q: "How do ghost invites work?",
    a: "When you create a group, other members start as ghost profiles. Share their access link from the Invite page. They open /view/[code] to see their side of the group. No app install required.",
  },
  {
    q: "Do you connect to my bank?",
    a: "No. Faircutter never connects to banks or reads transactions from your accounts. You enter expenses manually — that's intentional so rules stay in control.",
  },
  {
    q: "How do I export my data?",
    a: "CSV export for a group's expenses and balances is coming soon. Until then, you can view everything in the app or contact us for a manual export.",
  },
  {
    q: "How do I delete my account?",
    a: "Account deletion from Settings is coming soon. Email us and we will remove your data. We do not keep data you ask us to delete.",
  },
  {
    q: "Can I change a rule after expenses were added?",
    a: "Yes. Editing a rule affects future expenses only. Past expenses keep the split that was recorded when they were added.",
  },
  {
    q: "What does pricing look like?",
    a: "Faircutter is free during early access. We plan a $5/month Fair tier and a $4 Trip Pass for short-term groups. See the Pricing page — nothing is charged until we turn the paywall on.",
  },
];

export default function HelpPage() {
  return (
    <PublicPageShell narrow>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold">Help & FAQ</h1>
          <p className="mt-2 text-muted-foreground">
            Quick answers about rules, invites, and privacy.
          </p>
        </div>
        <dl className="space-y-6">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="font-medium">{item.q}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </div>
    </PublicPageShell>
  );
}
