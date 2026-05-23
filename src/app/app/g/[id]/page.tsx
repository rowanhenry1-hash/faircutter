import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import {
  expenseParticipants,
  expenses as expensesTable,
  ghostUsers,
  groups,
  rules as rulesTable,
  users,
} from "@/db/schema";
import { loadGroupBalanceContext } from "@/lib/balances";
import { loadGroupParticipants, loadGroupRules } from "@/lib/groups";
import { MemberAvatar } from "@/components/member-avatar";
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
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const userId = session.user.id;
  const { id } = await params;

  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) notFound();

  const participants = await loadGroupParticipants(id);
  const rules = await loadGroupRules(id);
  const { balances } = await loadGroupBalanceContext(id);
  const yourNet = balances.get(userId) ?? 0;

  const recentExpenses = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.groupId, id))
    .orderBy(desc(expensesTable.occurredAt))
    .limit(10);

  const expenseIds = recentExpenses.map((e) => e.id);
  const ruleIds = [
    ...new Set(
      recentExpenses.map((e) => e.ruleId).filter((r): r is string => !!r),
    ),
  ];

  const [payerUsers, payerGhosts, ruleRows, shareRows] = await Promise.all([
    recentExpenses.some((e) => e.paidByUserId)
      ? db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(
            inArray(
              users.id,
              recentExpenses
                .map((e) => e.paidByUserId)
                .filter((x): x is string => !!x),
            ),
          )
      : Promise.resolve([]),
    recentExpenses.some((e) => e.paidByGhostId)
      ? db
          .select({ id: ghostUsers.id, displayName: ghostUsers.displayName })
          .from(ghostUsers)
          .where(
            inArray(
              ghostUsers.id,
              recentExpenses
                .map((e) => e.paidByGhostId)
                .filter((x): x is string => !!x),
            ),
          )
      : Promise.resolve([]),
    ruleIds.length > 0
      ? db.select().from(rulesTable).where(inArray(rulesTable.id, ruleIds))
      : Promise.resolve([]),
    expenseIds.length > 0
      ? db
          .select()
          .from(expenseParticipants)
          .where(inArray(expenseParticipants.expenseId, expenseIds))
      : Promise.resolve([]),
  ]);

  const payerName = (expense: (typeof recentExpenses)[0]) => {
    if (expense.paidByUserId) {
      const u = payerUsers.find((p) => p.id === expense.paidByUserId);
      return u?.name || u?.email || "Member";
    }
    const g = payerGhosts.find((p) => p.id === expense.paidByGhostId);
    return g?.displayName || "Member";
  };

  const yourShare = (expenseId: string) => {
    const row = shareRows.find(
      (p) => p.expenseId === expenseId && p.userId === userId,
    );
    if (!row) return null;
    if (row.isExempt) return "exempt";
    return row.shareAmount;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
          <p
            className={`mt-2 text-sm font-medium ${
              yourNet > 0
                ? "text-emerald-600"
                : yourNet < 0
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
          >
            Your net:{" "}
            {yourNet === 0
              ? "settled up"
              : yourNet > 0
                ? `you're owed ${formatMoney(yourNet, group.currency)}`
                : `you owe ${formatMoney(-yourNet, group.currency)}`}
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
          <Button asChild variant="outline">
            <Link href={`/app/g/${id}/export/expenses`}>Export expenses</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/app/g/${id}/export/balances`}>Export balances</Link>
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
            <ul className="space-y-3 text-sm">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <MemberAvatar id={p.id} name={p.displayName} size="sm" />
                    <span>{p.displayName}</span>
                    {p.kind === "ghost" ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        no account
                      </span>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground">
                    {p.declaredIncome
                      ? formatMoney(p.declaredIncome, group.currency) + "/mo"
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
                    <li key={r.id} className="flex justify-between gap-2">
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
              No expenses yet.{" "}
              <Link
                href={`/app/g/${id}/expenses/new`}
                className="underline-offset-4 hover:underline"
              >
                Add the first one
              </Link>
              .
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {recentExpenses.map((e) => {
              const rule = ruleRows.find((r) => r.id === e.ruleId);
              const share = yourShare(e.id);

              return (
                <li key={e.id}>
                  <Link href={`/app/g/${id}/expenses/${e.id}`} className="block">
                    <Card className="transition hover:bg-muted">
                      <CardContent className="grid gap-2 p-4 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                        <div>
                          <div className="font-medium">
                            {e.description || e.category}
                          </div>
                          <div className="text-muted-foreground">
                            Paid by {payerName(e)} ·{" "}
                            {new Date(e.occurredAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {rule ? `Rule: ${rule.name}` : "No rule matched"}
                            {share !== null && share !== "exempt" ? (
                              <>
                                {" "}
                                · Your share:{" "}
                                {formatMoney(share as number, e.currency)}
                              </>
                            ) : share === "exempt" ? (
                              <> · You were exempt</>
                            ) : null}
                          </div>
                        </div>
                        <div className="font-semibold sm:text-right">
                          {formatMoney(e.amount, e.currency)}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
