import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groups, rules, templates } from "@/db/schema";
import { TEMPLATES, bindTemplate } from "@/rules/templates";
import { loadGroupParticipants } from "@/lib/groups";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) return null;

  const dbTemplates = await db.select().from(templates);
  // Fall back to in-memory list if DB hasn't been seeded.
  const list = dbTemplates.length > 0
    ? dbTemplates.map((t) => ({
        slug: t.slug,
        name: t.name,
        description: t.description,
        appliesTo: t.appliesTo,
        rules: t.ruleSet,
        suggestedMembers: t.suggestedMembers,
      }))
    : TEMPLATES;

  async function apply(formData: FormData) {
    "use server";
    const slug = formData.get("slug") as string;
    const session = await auth();
    if (!session?.user) redirect("/auth");

    const tpl = TEMPLATES.find((t) => t.slug === slug);
    if (!tpl) throw new Error("Unknown template");

    const participants = await loadGroupParticipants(id);
    // Bind placeholders by name match or by position.
    const keyMap: Record<string, string> = {};
    const placeholderKeys = collectPlaceholders(tpl.rules);
    for (let i = 0; i < placeholderKeys.length; i++) {
      keyMap[placeholderKeys[i]] = participants[i]?.id ?? participants[0].id;
    }
    const bound = bindTemplate(tpl.rules, keyMap);

    // Fill rotation orders if blank.
    for (const r of bound) {
      if (r.splitType === "rotating") {
        const p = r.parameters as { rotationOrder: string[]; currentIndex: number };
        if (p.rotationOrder.length === 0) {
          p.rotationOrder = participants.map((x) => x.id);
        }
      }
    }

    await db.delete(rules).where(eq(rules.groupId, id));
    await db.insert(rules).values(
      bound.map((r) => ({
        groupId: id,
        name: r.name,
        description: r.description,
        splitType: r.splitType as "equal",
        parameters: r.parameters,
        appliesToCategories: r.appliesToCategories,
        priority: r.priority,
        createdBy: session.user.id,
      })),
    );

    revalidatePath(`/app/g/${id}/rules`);
    redirect(`/app/g/${id}/rules`);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/g/${id}/rules/new`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Choose another method
        </Link>
        <h1 className="text-2xl font-semibold">Pick a template</h1>
        <p className="text-sm text-muted-foreground">
          Applying a template replaces your current rule set. You can edit
          anything afterward.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((t) => (
          <Card key={t.slug}>
            <CardHeader>
              <CardTitle className="text-base">{t.name}</CardTitle>
              <CardDescription>{t.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Rules:</p>
              <ul className="space-y-1">
                {t.rules.map((r, i) => (
                  <li key={i}>
                    · {r.name}{" "}
                    <span className="text-muted-foreground">({r.splitType})</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <form action={apply}>
                <input type="hidden" name="slug" value={t.slug} />
                <Button type="submit">Apply</Button>
              </form>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

function collectPlaceholders(ruleSet: { parameters: unknown }[]): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string" && v.startsWith("__") && v.endsWith("__")) {
      found.add(v.slice(2, -2));
      return;
    }
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(ruleSet.map((r) => r.parameters));
  return [...found];
}
