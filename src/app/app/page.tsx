import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { groups, groupMembers } from "@/db/schema";
import {
  latestActivityAt,
  loadGroupBalanceContext,
  sumUserShareThisMonth,
} from "@/lib/balances";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatMoney } from "@/lib/money";

export default async function AppDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const userId = session.user.id;

  const memberships = await db
    .select({ groupId: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId));

  const myGroups = await db
    .select()
    .from(groups)
    .where(
      memberships.length > 0
        ? or(
            eq(groups.createdBy, userId),
            ...memberships.map((m) => eq(groups.id, m.groupId)),
          )
        : eq(groups.createdBy, userId),
    );

  const groupsWithMeta = await Promise.all(
    myGroups.map(async (g) => {
      const ctx = await loadGroupBalanceContext(g.id);
      const yourNet = ctx.balances.get(userId) ?? 0;
      const yourShareThisMonth = sumUserShareThisMonth(
        ctx.expenseRows,
        ctx.participantRows,
        userId,
      );
      const lastActive = latestActivityAt(ctx.expenseRows);

      return {
        group: g,
        yourNet,
        yourShareThisMonth,
        lastActive,
      };
    }),
  );

  groupsWithMeta.sort((a, b) => {
    const aTime = a.lastActive?.getTime() ?? 0;
    const bTime = b.lastActive?.getTime() ?? 0;
    if (bTime !== aTime) return bTime - aTime;
    return b.group.createdAt.getTime() - a.group.createdAt.getTime();
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Your groups</h1>
          <p className="text-sm text-muted-foreground">
            Welcome, {session.user.name || session.user.email}.
          </p>
        </div>
        <Button asChild>
          <Link href="/onboarding">New group</Link>
        </Button>
      </div>

      {groupsWithMeta.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No groups yet</CardTitle>
            <CardDescription>
              Start a household, trip, or one-time group to begin tracking shared
              expenses with rules instead of guesswork.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/onboarding">Create your first group</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {groupsWithMeta.map(
            ({ group: g, yourNet, yourShareThisMonth, lastActive }) => (
              <li key={g.id}>
                <Link href={`/app/g/${g.id}`} className="block">
                  <Card className="transition hover:bg-muted">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{g.name}</CardTitle>
                          <CardDescription>
                            {g.type} · {g.currency}
                            {lastActive
                              ? ` · active ${lastActive.toLocaleDateString()}`
                              : " · no expenses yet"}
                          </CardDescription>
                        </div>
                        <div className="text-right text-sm">
                          <div
                            className={
                              yourNet > 0
                                ? "font-medium text-emerald-600"
                                : yourNet < 0
                                  ? "font-medium text-destructive"
                                  : "text-muted-foreground"
                            }
                          >
                            {yourNet === 0
                              ? "Settled up"
                              : yourNet > 0
                                ? `You're owed ${formatMoney(yourNet, g.currency)}`
                                : `You owe ${formatMoney(-yourNet, g.currency)}`}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">
                        Your share this month:{" "}
                        <span className="font-medium text-foreground">
                          {formatMoney(yourShareThisMonth, g.currency)}
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
