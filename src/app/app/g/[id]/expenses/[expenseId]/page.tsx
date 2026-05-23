import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  expenses as expensesTable,
  expenseParticipants,
  ghostUsers,
  groups,
  rules,
  users,
} from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { deleteExpense } from "../../actions";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string; expenseId: string }>;
}) {
  const { id, expenseId } = await params;
  const [expense] = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.id, expenseId));
  if (!expense) notFound();

  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  const participantsRows = await db
    .select({
      id: expenseParticipants.id,
      userId: expenseParticipants.userId,
      ghostId: expenseParticipants.ghostUserId,
      shareAmount: expenseParticipants.shareAmount,
      isExempt: expenseParticipants.isExempt,
      reason: expenseParticipants.exceptionReason,
      userName: users.name,
      userEmail: users.email,
      ghostName: ghostUsers.displayName,
    })
    .from(expenseParticipants)
    .leftJoin(users, eq(users.id, expenseParticipants.userId))
    .leftJoin(ghostUsers, eq(ghostUsers.id, expenseParticipants.ghostUserId))
    .where(eq(expenseParticipants.expenseId, expenseId));

  const matchedRule = expense.ruleId
    ? (await db.select().from(rules).where(eq(rules.id, expense.ruleId)))[0]
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/g/${id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← {group?.name ?? "Group"}
        </Link>
        <h1 className="text-2xl font-semibold">
          {expense.description || expense.category}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatMoney(expense.amount, expense.currency)} · {expense.category} ·{" "}
          {new Date(expense.occurredAt).toLocaleDateString()}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {matchedRule ? matchedRule.name : "Equal split (no matching rule)"}
          </CardTitle>
          <CardDescription>
            {matchedRule
              ? `Applied: ${matchedRule.splitType}`
              : "No rule matched — fallback equal split was used."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border text-sm">
            {participantsRows.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between py-2"
              >
                <div>
                  <div>{p.userName || p.ghostName || p.userEmail || "—"}</div>
                  {p.reason ? (
                    <div className="text-xs text-muted-foreground">
                      {p.reason}
                    </div>
                  ) : null}
                </div>
                <div
                  className={
                    p.isExempt ? "text-muted-foreground" : "font-medium"
                  }
                >
                  {p.isExempt
                    ? "exempt"
                    : formatMoney(p.shareAmount, expense.currency)}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter className="justify-end">
          <form action={deleteExpense}>
            <input type="hidden" name="groupId" value={id} />
            <input type="hidden" name="expenseId" value={expenseId} />
            <Button type="submit" variant="destructive" size="sm">
              Delete expense
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
