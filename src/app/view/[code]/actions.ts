"use server";
/**
 * Server actions for the ghost-user public viewer.
 *
 * Auth model: the access code is the only credential. Every action takes
 * `code` as a hidden form field and resolves it; if the code doesn't match
 * the rest of the inputs (e.g. recording a settlement from a different
 * person), the action throws.
 */
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  expenseParticipants,
  expenses as expensesTable,
  ghostUsers,
  groupMembers,
  settlements,
} from "@/db/schema";
import { loadGroupParticipants } from "@/lib/groups";
import { resolveAccessCode } from "@/lib/ghost";
import { stringToMinorUnits } from "@/lib/money";

const settleSchema = z.object({
  code: z.string().min(1),
  toId: z.string().min(1),
  amount: z.string().min(1),
  note: z.string().optional(),
});

/**
 * The ghost identified by `code` marks themselves as having paid `toId`.
 * Only the ghost themselves can use their own code, so only `from=ghost.id`
 * is allowed here.
 */
export async function recordGhostSettlement(formData: FormData) {
  const parsed = settleSchema.parse({
    code: formData.get("code"),
    toId: formData.get("toId"),
    amount: formData.get("amount"),
    note: (formData.get("note") as string) || undefined,
  });

  const resolved = await resolveAccessCode(parsed.code);
  if (!resolved) throw new Error("Invalid access code");
  const { ghost, group } = resolved;

  const amount = stringToMinorUnits(parsed.amount, group.currency);
  if (amount <= 0) throw new Error("Amount must be positive");

  const participants = await loadGroupParticipants(group.id);
  const to = participants.find((p) => p.id === parsed.toId);
  if (!to) throw new Error("Unknown recipient");

  await db.insert(settlements).values({
    groupId: group.id,
    fromGhostId: ghost.id,
    toUserId: to.kind === "user" ? to.id : null,
    toGhostId: to.kind === "ghost" ? to.id : null,
    amount,
    currency: group.currency,
    note: parsed.note,
    settlementType: "manual",
  });

  revalidatePath(`/view/${encodeURIComponent(parsed.code)}`);
  revalidatePath(`/app/g/${group.id}/balances`);
  revalidatePath(`/app/g/${group.id}`);
}

/**
 * Claim an access code: associate the ghost with a real signed-in user.
 *
 * Re-points the group_members row from `ghostUserId` to `userId`. Existing
 * expense_participants, expenses.paidByGhostId, and settlements continue to
 * reference the ghost by id (history is preserved). The ghost row itself
 * remains, marked claimed, so historical labels still resolve.
 *
 * Idempotent: if already claimed by the same user, no-op. If claimed by a
 * different user, throws.
 */
export async function claimGhost(args: {
  accessCode: string;
  userId: string;
}) {
  const resolved = await resolveAccessCode(args.accessCode);
  if (!resolved) throw new Error("Invalid access code");
  const { ghost, group } = resolved;

  if (ghost.claimedByUserId) {
    if (ghost.claimedByUserId === args.userId) {
      return { groupId: group.id, alreadyClaimed: true };
    }
    throw new Error("This invite has already been claimed by someone else");
  }

  // Don't allow the creator of the group to claim a ghost in their own group —
  // they're already a member through their real user account.
  const [existingMembership] = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.groupId, group.id))
    .limit(50);
  if (existingMembership) {
    // Cheap check: if the user is already a member, skip the re-point.
    const alreadyMember = (
      await db
        .select()
        .from(groupMembers)
        .where(eq(groupMembers.groupId, group.id))
    ).some((m) => m.userId === args.userId);

    if (alreadyMember) {
      // Just mark ghost as claimed so the badge updates everywhere.
      await db
        .update(ghostUsers)
        .set({ claimedByUserId: args.userId, claimedAt: new Date() })
        .where(eq(ghostUsers.id, ghost.id));
      return { groupId: group.id, alreadyMember: true };
    }
  }

  // Re-point the group_members row from ghost to user.
  await db
    .update(groupMembers)
    .set({ userId: args.userId, ghostUserId: null })
    .where(eq(groupMembers.ghostUserId, ghost.id));

  // Mark ghost claimed (history references remain intact).
  await db
    .update(ghostUsers)
    .set({ claimedByUserId: args.userId, claimedAt: new Date() })
    .where(eq(ghostUsers.id, ghost.id));

  revalidatePath(`/app/g/${group.id}`);
  revalidatePath("/app");

  return { groupId: group.id };
}
