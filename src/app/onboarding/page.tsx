import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TEMPLATES } from "@/rules/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createGroup } from "@/app/app/g/[id]/actions";

const BLANK_TEMPLATE = {
  slug: "blank",
  name: "Start from scratch",
  description: "Create a group with no pre-built rules.",
  whoItsFor: "Power users who want to build every rule themselves.",
  appliesTo: "household" as const,
  suggestedMembers: [{ displayName: "You" }, { displayName: "Member 2" }],
  rules: [],
};

function GroupSetupForm({
  chosen,
}: {
  chosen: {
    slug: string;
    name: string;
    description: string;
    appliesTo: string;
    suggestedMembers: { displayName: string; declaredIncome?: number }[];
  };
}) {
  const suggestedMembers =
    chosen.suggestedMembers.length > 0
      ? chosen.suggestedMembers
      : [{ displayName: "You" }, { displayName: "Member 2" }];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div>
        <Link
          href="/onboarding"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Pick a different template
        </Link>
        <h1 className="text-2xl font-semibold">{chosen.name}</h1>
        <p className="text-sm text-muted-foreground">{chosen.description}</p>
      </div>

      <form action={createGroup}>
        {chosen.slug !== "blank" ? (
          <input type="hidden" name="templateSlug" value={chosen.slug} />
        ) : null}
        <input
          type="hidden"
          name="type"
          value={chosen.appliesTo === "trip" ? "trip" : "household"}
        />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <Label htmlFor="name">Group name</Label>
              <Input id="name" name="name" placeholder="Our place" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                name="currency"
                defaultValue="USD"
                maxLength={3}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Members (one per line — you should be first)</Label>
              <textarea
                name="memberNames"
                defaultValue={suggestedMembers
                  .map((m) => m.displayName)
                  .join("\n")}
                rows={Math.max(4, suggestedMembers.length + 1)}
                className="w-full rounded border border-input bg-background p-2 text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">
                Everyone after you gets a ghost profile. After creating the group,
                open Invite to copy an access link for each person — they can use
                Faircutter without signing up.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>
                Monthly income per member (optional, leave blank to skip — one
                per line)
              </Label>
              <textarea
                name="memberIncomes"
                placeholder="7500&#10;4500"
                defaultValue={suggestedMembers
                  .map((m) => m.declaredIncome ?? "")
                  .join("\n")}
                rows={Math.max(4, suggestedMembers.length + 1)}
                className="w-full rounded border border-input bg-background p-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Used for by-income rules. Stored privately in your group.
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">Create group</Button>
          </CardFooter>
        </Card>
      </form>
    </main>
  );
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const { template: chosenSlug = "" } = await searchParams;
  const chosen =
    chosenSlug === "blank"
      ? BLANK_TEMPLATE
      : TEMPLATES.find((t) => t.slug === chosenSlug);

  if (chosen) {
    return <GroupSetupForm chosen={chosen} />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <div>
        <Link
          href="/app"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold">New group</h1>
        <p className="text-sm text-muted-foreground">
          Who do you split money with? Pick a starting point — you can edit rules
          anytime.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {TEMPLATES.map((t) => (
          <Link key={t.slug} href={`?template=${t.slug}`} className="block">
            <Card className="h-full transition hover:bg-muted">
              <CardHeader>
                <CardTitle className="text-base">{t.name}</CardTitle>
                <p className="text-xs font-medium text-primary">{t.whoItsFor}</p>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">None of these</CardTitle>
          <CardDescription>{BLANK_TEMPLATE.whoItsFor}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Link
            href="?template=blank"
            className="text-sm underline-offset-4 hover:underline"
          >
            Start blank →
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
