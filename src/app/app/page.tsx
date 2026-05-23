import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { groups, groupMembers } from "@/db/schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AppDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const userId = session.user.id;

  // Groups the user created OR is a member of.
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
    )
    .orderBy(desc(groups.createdAt));

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

      {myGroups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No groups yet</CardTitle>
            <CardDescription>
              Start a household, trip, or one-time group to begin tracking
              shared expenses with rules instead of guesswork.
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
          {myGroups.map((g) => (
            <li key={g.id}>
              <Link href={`/app/g/${g.id}`} className="block">
                <Card className="transition hover:bg-muted">
                  <CardHeader>
                    <CardTitle className="text-base">{g.name}</CardTitle>
                    <CardDescription>
                      {g.type} · {g.currency} · {g.status}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
