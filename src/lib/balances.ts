/**
 * Balance loading and pairwise debt simplification.
 * Keeps balance UI logic out of the rules engine (Step 7).
 */
import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  expenseParticipants,
  expenses as expensesTable,
  settlements as settlementsTable,
} from "@/db/schema";
import { loadGroupParticipants } from "@/lib/groups";
import { computeBalances } from "@/rules/engine";
import { computePairwiseDebts } from "@/lib/pairwise-debts";

export { computePairwiseDebts } from "@/lib/pairwise-debts";
export type { PairwiseDebt } from "@/lib/pairwise-debts";

export async function loadGroupBalanceContext(groupId: string) {
  const participants = await loadGroupParticipants(groupId);

  const expenseRows = await db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.groupId, groupId));

  const expenseIds = expenseRows.map((e) => e.id);
  const participantRows =
    expenseIds.length > 0
      ? await db
          .select()
          .from(expenseParticipants)
          .where(inArray(expenseParticipants.expenseId, expenseIds))
      : [];

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
    .where(eq(settlementsTable.groupId, groupId));

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

  const pairwiseDebts = computePairwiseDebts(balances);

  return {
    participants,
    expenseRows,
    participantRows,
    balances,
    pairwiseDebts,
  };
}

/** Sum of the user's share amounts in the current calendar month. */
export function sumUserShareThisMonth(
  expenseRows: Array<{ id: string; occurredAt: Date }>,
  participantRows: Array<{
    expenseId: string;
    userId: string | null;
    ghostUserId: string | null;
    shareAmount: number;
    isExempt: boolean;
  }>,
  userId: string,
): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const thisMonthIds = new Set(
    expenseRows
      .filter((e) => e.occurredAt >= monthStart)
      .map((e) => e.id),
  );

  return participantRows
    .filter(
      (p) =>
        p.userId === userId &&
        thisMonthIds.has(p.expenseId) &&
        !p.isExempt,
    )
    .reduce((sum, p) => sum + p.shareAmount, 0);
}

/** Most recent expense date in a group, or null if none. */
export function latestActivityAt(
  expenseRows: Array<{ occurredAt: Date }>,
): Date | null {
  if (expenseRows.length === 0) return null;
  return expenseRows.reduce(
    (latest, e) => (e.occurredAt > latest ? e.occurredAt : latest),
    expenseRows[0].occurredAt,
  );
}
