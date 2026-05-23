/**
 * Group-level helpers used by server components and server actions.
 * Centralized so the membership check is consistent everywhere.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  groups,
  groupMembers,
  ghostUsers,
  rules as rulesTable,
  expenses as expensesTable,
  expenseParticipants,
  users,
} from "@/db/schema";
import type { Participant, Rule } from "@/rules/types";

export async function getGroupOr404(groupId: string) {
  const [g] = await db.select().from(groups).where(eq(groups.id, groupId));
  if (!g) {
    throw new Error("Group not found");
  }
  return g;
}

export async function loadGroupParticipants(groupId: string): Promise<Participant[]> {
  const rows = await db
    .select({
      memberId: groupMembers.id,
      userId: groupMembers.userId,
      ghostId: groupMembers.ghostUserId,
      incomeSnapshot: groupMembers.incomeSnapshot,
      ghostName: ghostUsers.displayName,
      ghostIncome: ghostUsers.declaredIncome,
      userName: users.name,
      userEmail: users.email,
    })
    .from(groupMembers)
    .leftJoin(ghostUsers, eq(ghostUsers.id, groupMembers.ghostUserId))
    .leftJoin(users, eq(users.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId));

  return rows.map((r) => ({
    id: (r.ghostId ?? r.userId) as string,
    kind: r.ghostId ? ("ghost" as const) : ("user" as const),
    displayName:
      r.ghostName ?? r.userName ?? r.userEmail ?? "Member",
    declaredIncome: r.incomeSnapshot ?? r.ghostIncome ?? undefined,
  }));
}

export async function loadGroupRules(groupId: string): Promise<Rule[]> {
  const rows = await db
    .select()
    .from(rulesTable)
    .where(eq(rulesTable.groupId, groupId));

  return rows
    .filter((r) => r.isActive)
    .map(
      (r) =>
        ({
          id: r.id,
          name: r.name,
          priority: r.priority,
          appliesToCategories: r.appliesToCategories ?? [],
          splitType: r.splitType,
          parameters: r.parameters,
        }) as Rule,
    );
}

export async function loadGroupExpenses(groupId: string) {
  return db
    .select()
    .from(expensesTable)
    .where(eq(expensesTable.groupId, groupId));
}

export async function loadExpenseParticipants(expenseId: string) {
  return db
    .select()
    .from(expenseParticipants)
    .where(eq(expenseParticipants.expenseId, expenseId));
}
