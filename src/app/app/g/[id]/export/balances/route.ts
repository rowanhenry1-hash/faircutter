import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db/client";
import { groupMembers, groups } from "@/db/schema";
import { csvResponse, rowsToCsv } from "@/lib/csv";
import { loadGroupBalanceContext } from "@/lib/balances";
import { minorUnitsToString } from "@/lib/money";

type Params = {
  params: Promise<{ id: string }>;
};

async function requireMembership(groupId: string) {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
  if (!group) notFound();

  if (group.createdBy === session.user.id) return group;

  const [membership] = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!membership) notFound();
  return group;
}

function filenameSafe(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "group";
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const group = await requireMembership(id);
  const { participants, balances, pairwiseDebts } =
    await loadGroupBalanceContext(id);

  const nameById = new Map(
    participants.map((participant) => [participant.id, participant.displayName]),
  );
  const kindById = new Map(
    participants.map((participant) => [participant.id, participant.kind]),
  );

  const netRows = participants
    .map((participant) => {
      const net = balances.get(participant.id) ?? 0;
      return {
        row_type: "net_balance",
        participant_id: participant.id,
        participant_kind: participant.kind,
        participant_name: participant.displayName,
        net_amount: minorUnitsToString(net, group.currency),
        currency: group.currency,
        owes_from_id: "",
        owes_from_name: "",
        owes_to_id: "",
        owes_to_name: "",
        debt_amount: "",
      };
    })
    .sort((a, b) => Number(b.net_amount) - Number(a.net_amount));

  const debtRows = pairwiseDebts.map((debt) => ({
    row_type: "pairwise_debt",
    participant_id: "",
    participant_kind: "",
    participant_name: "",
    net_amount: "",
    currency: group.currency,
    owes_from_id: debt.from,
    owes_from_name: nameById.get(debt.from) ?? "Someone",
    owes_to_id: debt.to,
    owes_to_name: nameById.get(debt.to) ?? "Someone",
    debt_amount: minorUnitsToString(debt.amount, group.currency),
  }));

  const participantKindRows = participants.map((participant) => ({
    row_type: "participant",
    participant_id: participant.id,
    participant_kind: kindById.get(participant.id) ?? "",
    participant_name: participant.displayName,
    net_amount: "",
    currency: group.currency,
    owes_from_id: "",
    owes_from_name: "",
    owes_to_id: "",
    owes_to_name: "",
    debt_amount: "",
  }));

  const headers = [
    "row_type",
    "participant_id",
    "participant_kind",
    "participant_name",
    "net_amount",
    "currency",
    "owes_from_id",
    "owes_from_name",
    "owes_to_id",
    "owes_to_name",
    "debt_amount",
  ];

  return csvResponse(
    `${filenameSafe(group.name)}-balances.csv`,
    rowsToCsv(headers, [...netRows, ...debtRows, ...participantKindRows]),
  );
}
