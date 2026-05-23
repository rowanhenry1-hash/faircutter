import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  expenseParticipants,
  expenses as expensesTable,
  groups,
  settlements as settlementsTable,
} from "@/db/schema";
import { loadGroupParticipants } from "@/lib/groups";
import { computeBalances } from "@/rules/engine";
import { formatMoney } from "@/lib/money";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function BalancesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) return null;

  const participants = await loadGroupParticipants(id);

  const expenseRows = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.groupId, id));

  const participantRows = await db
    .select()
    .from(expenseParticipants);

  const expenseInputs = expenseRows.map((e) => ({
    amount: e.amount,
    paidBy: (e.paidByUserId ?? e.paidByGhostId) as string,
    split: participantRows
      .filter((p) => p.expenseId === e.id)
      .map((p) => ({
        participantId: (p.userId ?? p.ghostUserId) as string,
        shareAmount: p.shareAmount,
        isExempt: p.isExempt,
        reason: p.exceptionReason ?? "",
      })),
  }));

  const settlementRows = await db
    .select()
    .from(settlementsTable)
    .where(eq(settlementsTable.groupId, id));

  const settlementInputs = settlementRows.map((s) => ({
    from: (s.fromUserId ?? s.fromGhostId) as string,
    to: (s.toUserId ?? s.toGhostId) as string,
    amount: s.amount,
  }));

  const balances = computeBalances({
    participants,
    expenses: expenseInputs,
    settlements: settlementInputs,
  });

  const sorted = participants
    .map((p) => ({ p, net: balances.get(p.id) ?? 0 }))
    .sort((a, b) => b.net - a.net);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/g/${id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← {group.name}
        </Link>
        <h1 className="text-2xl font-semibold">Balances</h1>
        <p className="text-sm text-muted-foreground">
          Positive means owed to them. Negative means they owe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Net per person</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border text-sm">
            {sorted.map(({ p, net }) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>{p.displayName}</span>
                <span
                  className={
                    net > 0
                      ? "font-medium text-emerald-600"
                      : net < 0
                        ? "font-medium text-destructive"
                        : "text-muted-foreground"
                  }
                >
                  {net === 0
                    ? "settled"
                    : (net > 0 ? "+" : "") +
                      formatMoney(net, group.currency)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
