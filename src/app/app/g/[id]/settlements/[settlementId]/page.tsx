import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  ghostUsers,
  groups,
  settlements as settlementsTable,
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
import { deleteSettlement } from "../../actions";

async function participantName(
  userId: string | null,
  ghostId: string | null,
): Promise<string> {
  if (userId) {
    const [u] = await db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    return u?.name || u?.email || "Member";
  }
  if (ghostId) {
    const [g] = await db
      .select({ displayName: ghostUsers.displayName })
      .from(ghostUsers)
      .where(eq(ghostUsers.id, ghostId));
    return g?.displayName || "Member";
  }
  return "Unknown";
}

export default async function SettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string; settlementId: string }>;
}) {
  const { id, settlementId } = await params;

  const [settlement] = await db
    .select()
    .from(settlementsTable)
    .where(eq(settlementsTable.id, settlementId));
  if (!settlement || settlement.groupId !== id) notFound();

  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) notFound();

  const [fromName, toName] = await Promise.all([
    participantName(settlement.fromUserId, settlement.fromGhostId),
    participantName(settlement.toUserId, settlement.toGhostId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/g/${id}/balances`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Balances
        </Link>
        <h1 className="text-2xl font-semibold">Settlement</h1>
        <p className="text-sm text-muted-foreground">{group.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {formatMoney(settlement.amount, settlement.currency)}
          </CardTitle>
          <CardDescription>
            Recorded {new Date(settlement.markedPaidAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <DetailRow label="From" value={fromName} />
          <DetailRow label="To" value={toName} />
          <DetailRow
            label="Amount"
            value={formatMoney(settlement.amount, settlement.currency)}
          />
          <DetailRow
            label="Date"
            value={new Date(settlement.markedPaidAt).toLocaleDateString()}
          />
          {settlement.note ? (
            <DetailRow label="Note" value={settlement.note} />
          ) : null}
        </CardContent>
        <CardFooter className="justify-between">
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/g/${id}/balances`}>Back to balances</Link>
          </Button>
          <form action={deleteSettlement}>
            <input type="hidden" name="groupId" value={id} />
            <input type="hidden" name="settlementId" value={settlementId} />
            <Button type="submit" variant="destructive" size="sm">
              Delete
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
