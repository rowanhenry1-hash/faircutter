import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { expenses as expensesTable, groups } from "@/db/schema";
import { loadGroupParticipants, loadGroupRules } from "@/lib/groups";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/money";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) notFound();

  const participants = await loadGroupParticipants(id);
  const rules = await loadGroupRules(id);
  const recentExpenses = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.groupId, id))
    .orderBy(desc(expensesTable.occurredAt))
    .limit(10);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/app"
            className="text-xs text-muted-foreground hover:underline"
          >
            ← All groups
          </Link>
          <h1 className="text-2xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground">
            {group.type} · {group.currency} · {participants.length} members
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href={`/app/g/${id}/expenses/new`}>Add expense</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/app/g/${id}/rules`}>Rules</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/app/g/${id}/balances`}>Balances</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/app/g/${id}/invite`}>Invite</Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
            <CardDescription>
              {participants.filter((p) => p.kind === "ghost").length} without
              accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {participants.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.displayName}</span>
                  <span className="text-muted-foreground">
                    {p.declaredIncome
                      ? formatMoney(p.declaredIncome, group.currency) + "/mo"
                      : p.kind === "ghost"
                        ? "ghost"
                        : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active rules</CardTitle>
            <CardDescription>{rules.length} rules</CardDescription>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rules yet.{" "}
                <Link
                  href={`/app/g/${id}/rules/new`}
                  className="underline-offset-4 hover:underline"
                >
                  Add one
                </Link>{" "}
                or{" "}
                <Link
                  href={`/app/g/${id}/rules/finder`}
                  className="underline-offset-4 hover:underline"
                >
                  use the rule finder
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {[...rules]
                  .sort((a, b) => a.priority - b.priority)
                  .map((r) => (
                    <li key={r.id} className="flex justify-between">
                      <span>{r.name}</span>
                      <span className="text-muted-foreground">
                        {r.splitType}
                        {r.appliesToCategories.length > 0
                          ? ` · ${r.appliesToCategories.join(", ")}`
                          : ""}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Recent expenses</h2>
        {recentExpenses.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No expenses yet.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {recentExpenses.map((e) => (
              <li key={e.id}>
                <Link href={`/app/g/${id}/expenses/${e.id}`} className="block">
                  <Card className="transition hover:bg-muted">
                    <CardContent className="flex items-center justify-between p-4 text-sm">
                      <div>
                        <div className="font-medium">
                          {e.description || e.category}
                        </div>
                        <div className="text-muted-foreground">
                          {e.category} · {new Date(e.occurredAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="font-semibold">
                        {formatMoney(e.amount, e.currency)}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
