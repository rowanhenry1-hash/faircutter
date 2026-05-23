import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ghostUsers, groups } from "@/db/schema";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) return null;

  const ghosts = await db
    .select()
    .from(ghostUsers)
    .where(eq(ghostUsers.groupId, id));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/g/${id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← {group.name}
        </Link>
        <h1 className="text-2xl font-semibold">Invite</h1>
        <p className="text-sm text-muted-foreground">
          Anyone with a code can view their balance and mark themselves paid —
          no account required. The full ghost-user / no-signup viewer ships in
          Step 8.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active access codes</CardTitle>
          <CardDescription>
            One per ghost member. Share via text, email, or QR.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ghosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ghost members.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {ghosts.map((g) => (
                <li key={g.id} className="flex justify-between py-2">
                  <span>{g.displayName}</span>
                  <code className="rounded bg-muted px-2 py-0.5">
                    {g.accessCode}
                  </code>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
