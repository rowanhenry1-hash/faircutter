import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function NewRuleChoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const options = [
    {
      title: "Start from a template",
      desc: "Pick a pre-built rule set (couple, roommates, parents+child, trip). Edit anything after.",
      href: `/app/g/${id}/rules/templates`,
    },
    {
      title: "Rule finder",
      desc: "Answer a few card-based questions. We assemble the rules for you.",
      href: `/app/g/${id}/rules/finder`,
    },
    {
      title: "Start from scratch",
      desc: "Build a rule by hand with every parameter exposed. For power users.",
      href: `/app/g/${id}/rules/editor`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/g/${id}/rules`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Rules
        </Link>
        <h1 className="text-2xl font-semibold">Add a rule</h1>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {options.map((o) => (
          <Link key={o.href} href={o.href} className="block">
            <Card className="h-full transition hover:bg-muted">
              <CardHeader>
                <CardTitle className="text-base">{o.title}</CardTitle>
                <CardDescription>{o.desc}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                →
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
