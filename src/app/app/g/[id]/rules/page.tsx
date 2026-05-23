import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groups, rules as rulesTable } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deleteRule, updateRulePriority } from "../actions";

export default async function RulesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) return null;

  const rows = await db
    .select()
    .from(rulesTable)
    .where(eq(rulesTable.groupId, id));

  const sorted = [...rows].sort((a, b) => a.priority - b.priority);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href={`/app/g/${id}`}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← {group.name}
          </Link>
          <h1 className="text-2xl font-semibold">Rules</h1>
          <p className="text-sm text-muted-foreground">
            Lower priority numbers are checked first. The first rule whose
            categories match an expense wins.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/app/g/${id}/rules/new`}>New rule</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/app/g/${id}/rules/finder`}>Rule finder</Link>
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No rules yet</CardTitle>
            <CardDescription>
              Start from a template, run the finder, or build one by hand.
            </CardDescription>
          </CardHeader>
          <CardFooter className="gap-2">
            <Button asChild>
              <Link href={`/app/g/${id}/rules/finder`}>Run rule finder</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/app/g/${id}/rules/new`}>Manual rule</Link>
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <ul className="space-y-2">
          {sorted.map((r) => (
            <li key={r.id}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{r.name}</CardTitle>
                      <CardDescription>
                        {r.splitType}
                        {(r.appliesToCategories ?? []).length > 0
                          ? ` · ${(r.appliesToCategories as string[]).join(", ")}`
                          : " · all categories"}
                      </CardDescription>
                    </div>
                    <form
                      action={updateRulePriority}
                      className="flex items-center gap-1"
                    >
                      <input type="hidden" name="groupId" value={id} />
                      <input type="hidden" name="ruleId" value={r.id} />
                      <label className="text-xs text-muted-foreground">
                        priority
                      </label>
                      <input
                        type="number"
                        name="priority"
                        defaultValue={r.priority}
                        className="h-8 w-16 rounded border border-input bg-background px-2 text-sm"
                      />
                      <Button size="sm" variant="outline" type="submit">
                        Save
                      </Button>
                    </form>
                  </div>
                </CardHeader>
                <CardContent>
                  {r.description ? (
                    <p className="mb-2 text-sm">{r.description}</p>
                  ) : null}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      View parameters
                    </summary>
                    <pre className="mt-2 overflow-auto rounded bg-muted p-3">
                      {JSON.stringify(r.parameters, null, 2)}
                    </pre>
                  </details>
                </CardContent>
                <CardFooter className="justify-end gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/g/${id}/rules/${r.id}`}>Edit</Link>
                  </Button>
                  <form action={deleteRule}>
                    <input type="hidden" name="groupId" value={id} />
                    <input type="hidden" name="ruleId" value={r.id} />
                    <Button size="sm" variant="destructive" type="submit">
                      Delete
                    </Button>
                  </form>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
