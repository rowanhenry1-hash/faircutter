/**
 * Screen 16 — public ghost-user viewer.
 *
 * No authentication required: holding the access code is the only credential.
 * Shows the ghost's net, expenses that affected them, the rule that applied,
 * and lets them mark a settlement against anyone they owe.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, or, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  expenseParticipants,
  expenses as expensesTable,
  ghostUsers,
  groupMembers,
  rules as rulesTable,
  users,
} from "@/db/schema";
import { resolveAccessCode } from "@/lib/ghost";
import { loadGroupBalanceContext } from "@/lib/balances";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GhostSettleForm } from "./settle-form";

export default async function GhostViewerPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const resolved = await resolveAccessCode(code);
  if (!resolved) notFound();

  const { ghost, group, claimedBy } = resolved;

  // If this ghost has been claimed already, send them to the signed-in app —
  // the public viewer is no longer the right surface.
  if (claimedBy) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-2xl font-semibold">This invite was claimed</h1>
        <p className="text-sm text-muted-foreground">
          {ghost.displayName} now has an account
          {claimedBy.name ? ` (${claimedBy.name})` : ""}.
        </p>
        <Button asChild>
          <Link href={`/auth?next=/app/g/${group.id}`}>Sign in</Link>
        </Button>
        <Link
          href="/"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Back home
        </Link>
      </main>
    );
  }

  const { participants, balances, pairwiseDebts } =
    await loadGroupBalanceContext(group.id);
  const yourNet = balances.get(ghost.id) ?? 0;
  const nameById = new Map(participants.map((p) => [p.id, p.displayName]));

  // Expenses where this ghost has a participant row, most recent 20.
  const myParticipantRows = await db
    .select()
    .from(expenseParticipants)
    .where(eq(expenseParticipants.ghostUserId, ghost.id));
  const myExpenseIds = [...new Set(myParticipantRows.map((r) => r.expenseId))];

  const myExpenses =
    myExpenseIds.length > 0
      ? await db
          .select()
          .from(expensesTable)
          .where(inArray(expensesTable.id, myExpenseIds))
          .orderBy(desc(expensesTable.occurredAt))
          .limit(20)
      : [];

  const ruleIds = [
    ...new Set(myExpenses.map((e) => e.ruleId).filter((x): x is string => !!x)),
  ];
  const ruleRows =
    ruleIds.length > 0
      ? await db.select().from(rulesTable).where(inArray(rulesTable.id, ruleIds))
      : [];
  const ruleName = (id: string | null) =>
    id ? ruleRows.find((r) => r.id === id)?.name ?? "Rule" : "Equal split";

  // Pairwise debts where this ghost owes someone — surface those for settlement.
  const debtsIOwe = pairwiseDebts.filter((d) => d.from === ghost.id);

  // Active rules in the group, for the "how this works" panel.
  const activeRules = await db
    .select()
    .from(rulesTable)
    .where(eq(rulesTable.groupId, group.id));

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-10">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {group.name} · viewing as
        </p>
        <h1 className="text-2xl font-semibold">{ghost.displayName}</h1>
        <p
          className={`text-sm font-medium ${
            yourNet > 0
              ? "text-emerald-600"
              : yourNet < 0
                ? "text-destructive"
                : "text-muted-foreground"
          }`}
        >
          {yourNet === 0
            ? "You're settled up."
            : yourNet > 0
              ? `You're owed ${formatMoney(yourNet, group.currency)}.`
              : `You owe ${formatMoney(-yourNet, group.currency)} total.`}
        </p>
      </header>

      {debtsIOwe.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mark a payment</CardTitle>
            <CardDescription>
              When you&apos;ve paid someone in real life, record it here so
              everyone sees the balance update.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {debtsIOwe.map((d) => (
              <div
                key={`${d.from}-${d.to}`}
                className="rounded-lg border border-border p-3"
              >
                <p className="mb-2 text-sm">
                  You owe{" "}
                  <span className="font-medium">
                    {nameById.get(d.to) ?? "someone"}
                  </span>{" "}
                  <span className="font-semibold">
                    {formatMoney(d.amount, group.currency)}
                  </span>
                </p>
                <GhostSettleForm
                  code={ghost.accessCode}
                  toId={d.to}
                  toName={nameById.get(d.to) ?? "them"}
                  defaultAmount={d.amount}
                  currency={group.currency}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent expenses</CardTitle>
          <CardDescription>
            Showing the {myExpenses.length} most recent expenses that affected
            you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {myExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No expenses yet.
            </p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {myExpenses.map((e) => {
                const mine = myParticipantRows.find(
                  (p) => p.expenseId === e.id,
                );
                return (
                  <li key={e.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {e.description || e.category}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {e.category} ·{" "}
                          {new Date(e.occurredAt).toLocaleDateString()} ·{" "}
                          {ruleName(e.ruleId)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">
                          {formatMoney(e.amount, e.currency)} total
                        </div>
                        <div
                          className={
                            mine?.isExempt
                              ? "text-muted-foreground"
                              : "font-medium"
                          }
                        >
                          {mine?.isExempt
                            ? "exempt"
                            : `your share ${formatMoney(mine?.shareAmount ?? 0, e.currency)}`}
                        </div>
                      </div>
                    </div>
                    {mine?.exceptionReason ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {mine.exceptionReason}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How splits are calculated</CardTitle>
          <CardDescription>
            {activeRules.length} active rule{activeRules.length === 1 ? "" : "s"}{" "}
            in {group.name}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeRules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No rules — expenses split equally by default.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...activeRules]
                .sort((a, b) => a.priority - b.priority)
                .map((r) => (
                  <li
                    key={r.id}
                    className="flex justify-between text-muted-foreground"
                  >
                    <span className="text-foreground">{r.name}</span>
                    <span>
                      {r.splitType}
                      {(r.appliesToCategories as string[] | null)?.length
                        ? ` · ${(r.appliesToCategories as string[]).join(", ")}`
                        : ""}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Keep your history</CardTitle>
          <CardDescription>
            You don&apos;t need an account to use Faircutter. But creating one
            lets you keep records across groups and devices.
          </CardDescription>
        </CardHeader>
        <CardFooter className="gap-2">
          <Button asChild>
            <Link
              href={`/auth?next=/view/${encodeURIComponent(ghost.accessCode)}/claim`}
            >
              Create an account
            </Link>
          </Button>
          <Link
            href="/"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Not now
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
