import { notFound, redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db/client";
import {
  expenseParticipants,
  expenses,
  ghostUsers,
  groupMembers,
  groups,
  rules,
  users,
} from "@/db/schema";
import { csvResponse, rowsToCsv, type CsvValue } from "@/lib/csv";
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

  const expenseRows = await db
    .select()
    .from(expenses)
    .where(eq(expenses.groupId, id));

  const expenseIds = expenseRows.map((expense) => expense.id);
  const participantRows =
    expenseIds.length > 0
      ? await db
          .select()
          .from(expenseParticipants)
          .where(inArray(expenseParticipants.expenseId, expenseIds))
      : [];

  const payerUserIds = [
    ...new Set(expenseRows.map((expense) => expense.paidByUserId).filter(Boolean)),
  ] as string[];
  const payerGhostIds = [
    ...new Set(expenseRows.map((expense) => expense.paidByGhostId).filter(Boolean)),
  ] as string[];
  const ruleIds = [
    ...new Set(expenseRows.map((expense) => expense.ruleId).filter(Boolean)),
  ] as string[];
  const participantUserIds = [
    ...new Set(participantRows.map((row) => row.userId).filter(Boolean)),
  ] as string[];
  const participantGhostIds = [
    ...new Set(participantRows.map((row) => row.ghostUserId).filter(Boolean)),
  ] as string[];

  const [payerUsers, payerGhosts, participantUsers, participantGhosts, ruleRows] =
    await Promise.all([
      payerUserIds.length > 0
        ? db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(inArray(users.id, payerUserIds))
        : Promise.resolve([]),
      payerGhostIds.length > 0
        ? db
            .select({ id: ghostUsers.id, displayName: ghostUsers.displayName })
            .from(ghostUsers)
            .where(inArray(ghostUsers.id, payerGhostIds))
        : Promise.resolve([]),
      participantUserIds.length > 0
        ? db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(inArray(users.id, participantUserIds))
        : Promise.resolve([]),
      participantGhostIds.length > 0
        ? db
            .select({ id: ghostUsers.id, displayName: ghostUsers.displayName })
            .from(ghostUsers)
            .where(inArray(ghostUsers.id, participantGhostIds))
        : Promise.resolve([]),
      ruleIds.length > 0
        ? db
            .select({ id: rules.id, name: rules.name, splitType: rules.splitType })
            .from(rules)
            .where(inArray(rules.id, ruleIds))
        : Promise.resolve([]),
    ]);

  const userNameById = new Map(
    [...payerUsers, ...participantUsers].map((user) => [
      user.id,
      user.name || user.email || "Member",
    ]),
  );
  const ghostNameById = new Map(
    [...payerGhosts, ...participantGhosts].map((ghost) => [
      ghost.id,
      ghost.displayName,
    ]),
  );
  const ruleById = new Map(ruleRows.map((rule) => [rule.id, rule]));

  const rows: Array<Record<string, CsvValue>> = expenseRows
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .flatMap((expense): Array<Record<string, CsvValue>> => {
      const shares = participantRows.filter((row) => row.expenseId === expense.id);
      const payerId = expense.paidByUserId ?? expense.paidByGhostId ?? "";
      const payerKind = expense.paidByUserId ? "user" : "ghost";
      const payerName = expense.paidByUserId
        ? userNameById.get(expense.paidByUserId)
        : expense.paidByGhostId
          ? ghostNameById.get(expense.paidByGhostId)
          : "";
      const rule = expense.ruleId ? ruleById.get(expense.ruleId) : null;

      if (shares.length === 0) {
        return [
          {
            expense_id: expense.id,
            occurred_at: expense.occurredAt,
            description: expense.description ?? "",
            category: expense.category,
            total_amount: minorUnitsToString(expense.amount, group.currency),
            currency: group.currency,
            paid_by_id: payerId,
            paid_by_kind: payerKind,
            paid_by_name: payerName ?? "",
            rule_id: expense.ruleId ?? "",
            rule_name: rule?.name ?? "",
            rule_type: rule?.splitType ?? "",
            participant_id: "",
            participant_kind: "",
            participant_name: "",
            share_amount: "",
            is_exempt: "",
            exception_reason: "",
          },
        ];
      }

      return shares.map((share) => {
        const participantId = share.userId ?? share.ghostUserId ?? "";
        const participantKind = share.userId ? "user" : "ghost";
        const participantName = share.userId
          ? userNameById.get(share.userId)
          : share.ghostUserId
            ? ghostNameById.get(share.ghostUserId)
            : "";

        return {
          expense_id: expense.id,
          occurred_at: expense.occurredAt,
          description: expense.description ?? "",
          category: expense.category,
          total_amount: minorUnitsToString(expense.amount, group.currency),
          currency: group.currency,
          paid_by_id: payerId,
          paid_by_kind: payerKind,
          paid_by_name: payerName ?? "",
          rule_id: expense.ruleId ?? "",
          rule_name: rule?.name ?? "",
          rule_type: rule?.splitType ?? "",
          participant_id: participantId,
          participant_kind: participantKind,
          participant_name: participantName ?? "",
          share_amount: minorUnitsToString(share.shareAmount, group.currency),
          is_exempt: share.isExempt,
          exception_reason: share.exceptionReason ?? "",
        };
      });
    });

  const headers = [
    "expense_id",
    "occurred_at",
    "description",
    "category",
    "total_amount",
    "currency",
    "paid_by_id",
    "paid_by_kind",
    "paid_by_name",
    "rule_id",
    "rule_name",
    "rule_type",
    "participant_id",
    "participant_kind",
    "participant_name",
    "share_amount",
    "is_exempt",
    "exception_reason",
  ];

  return csvResponse(
    `${filenameSafe(group.name)}-expenses.csv`,
    rowsToCsv(headers, rows),
  );
}
