import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groups } from "@/db/schema";
import { loadGroupBalanceContext } from "@/lib/balances";
import { SettleUpForm } from "@/components/settle-up-form";
import { formatMoney } from "@/lib/money";
import {
  Card,
  CardContent,
  CardDescription,
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
  if (!group) notFound();

  const { participants, balances, pairwiseDebts } =
    await loadGroupBalanceContext(id);

  const nameById = new Map(participants.map((p) => [p.id, p.displayName]));

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
          <CardTitle className="text-base">Who owes whom</CardTitle>
          <CardDescription>
            Simplified pairwise debts. Record a settlement when someone pays up.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pairwiseDebts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone is settled up.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {pairwiseDebts.map((debt) => (
                <li key={`${debt.from}-${debt.to}`} className="py-4 first:pt-0">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <span className="font-medium">
                        {nameById.get(debt.from) ?? "Someone"}
                      </span>{" "}
                      owes{" "}
                      <span className="font-medium">
                        {nameById.get(debt.to) ?? "someone"}
                      </span>{" "}
                      <span className="font-semibold text-destructive">
                        {formatMoney(debt.amount, group.currency)}
                      </span>
                    </div>
                    <SettleUpForm
                      groupId={id}
                      currency={group.currency}
                      fromId={debt.from}
                      toId={debt.to}
                      defaultAmount={debt.amount}
                      participants={participants.map((p) => ({
                        id: p.id,
                        displayName: p.displayName,
                      }))}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
                    : (net > 0 ? "+" : "") + formatMoney(net, group.currency)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
