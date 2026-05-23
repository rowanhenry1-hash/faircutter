"use server";
/**
 * Server actions for group-scoped operations: creating rules, expenses,
 * settlements, and applying templates.
 *
 * Every action calls `requireMembership` first.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/db/client";
import {
  expenseParticipants,
  expenses,
  ghostUsers,
  groupMembers,
  groups,
  rules,
} from "@/db/schema";
import {
  loadGroupParticipants,
  loadGroupRules,
} from "@/lib/groups";
import { applyRules } from "@/rules/engine";
import { ruleSchema, splitTypes, type Rule } from "@/rules/types";
import { stringToMinorUnits } from "@/lib/money";
import { TEMPLATES, bindTemplate } from "@/rules/templates";

async function requireMembership(groupId: string) {
  const session = await auth();
  if (!session?.user) redirect("/auth");
  const userId = session.user.id;

  const [g] = await db.select().from(groups).where(eq(groups.id, groupId));
  if (!g) throw new Error("Group not found");
  if (g.createdBy === userId) return { userId, group: g };

  const [mem] = await db
    .select()
    .from(groupMembers)
    .where(
      and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
    )
    .limit(1);
  if (!mem) throw new Error("Not a member of this group");
  return { userId, group: g };
}

// ---------------------------------------------------------------------------
// Group + member CRUD
// ---------------------------------------------------------------------------

const newGroupSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(["household", "trip", "one_time", "couple"]),
  currency: z.string().min(3).max(3),
  templateSlug: z.string().optional(),
  memberNames: z.array(z.string().min(1)).min(1),
  memberIncomes: z.array(z.number().int().nonnegative().optional().nullable()),
});

export async function createGroup(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const namesRaw = (formData.get("memberNames") as string) || "";
  const incomesRaw = (formData.get("memberIncomes") as string) || "";

  const memberNames = namesRaw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const memberIncomes = incomesRaw.split("\n").map((s) => {
    const v = s.trim();
    if (!v) return null;
    const n = Number(v.replace(/[^0-9]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
  });

  const parsed = newGroupSchema.parse({
    name: formData.get("name"),
    type: formData.get("type"),
    currency: ((formData.get("currency") as string) || "USD").toUpperCase(),
    templateSlug: (formData.get("templateSlug") as string) || undefined,
    memberNames,
    memberIncomes,
  });

  const [group] = await db
    .insert(groups)
    .values({
      name: parsed.name,
      type: parsed.type,
      currency: parsed.currency,
      createdBy: session.user.id,
    })
    .returning();

  // First member is the creator (as a real user member).
  await db.insert(groupMembers).values({
    groupId: group.id,
    userId: session.user.id,
    role: "owner",
    incomeSnapshot: parsed.memberIncomes[0] ?? null,
  });

  // Remaining members are ghost users (no signup required).
  const ghostMemberIds: string[] = [];
  const memberMap: Record<string, string> = { __creator__: session.user.id };

  for (let i = 0; i < parsed.memberNames.length; i++) {
    const name = parsed.memberNames[i];
    const income = parsed.memberIncomes[i] ?? null;
    if (i === 0) {
      // Skip — that's the creator above.
      memberMap[`m${i}`] = session.user.id;
      continue;
    }
    const accessCode = randomCode();
    const [ghost] = await db
      .insert(ghostUsers)
      .values({
        groupId: group.id,
        displayName: name,
        accessCode,
        declaredIncome: income,
      })
      .returning();
    await db.insert(groupMembers).values({
      groupId: group.id,
      ghostUserId: ghost.id,
      role: "member",
      incomeSnapshot: income,
    });
    ghostMemberIds.push(ghost.id);
    memberMap[`m${i}`] = ghost.id;
  }

  // If a template was chosen, materialize its rules.
  if (parsed.templateSlug) {
    const tpl = TEMPLATES.find((t) => t.slug === parsed.templateSlug);
    if (tpl) {
      // Heuristic: bind member keys by position from the template's
      // suggestedMembers (the user already sees those as a hint in the UI).
      const slugKeys = tpl.suggestedMembers.map((_, i) => `m${i}`);
      const tplKeyMap: Record<string, string> = {};
      // Also map the placeholder names used in the parents-plus-adult-child
      // template (__dad__, __mom__, __kid__) by position.
      const placeholderKeys = collectPlaceholders(tpl.rules);
      placeholderKeys.forEach((k, i) => {
        tplKeyMap[k] = memberMap[`m${i}`] ?? memberMap["m0"];
      });
      slugKeys.forEach((k) => {
        tplKeyMap[k] = memberMap[k] ?? memberMap["m0"];
      });
      const bound = bindTemplate(tpl.rules, tplKeyMap);
      // Rotating rules: fill rotationOrder with all members if blank.
      const allMembers = [session.user.id, ...ghostMemberIds];
      for (const r of bound) {
        if (r.splitType === "rotating") {
          const params = r.parameters as {
            rotationOrder: string[];
            currentIndex: number;
          };
          if (params.rotationOrder.length === 0) {
            params.rotationOrder = allMembers;
          }
        }
      }
      await db.insert(rules).values(
        bound.map((r) => ({
          groupId: group.id,
          name: r.name,
          description: r.description,
          splitType: r.splitType as (typeof splitTypes)[number],
          parameters: r.parameters,
          appliesToCategories: r.appliesToCategories,
          priority: r.priority,
          createdBy: session.user.id,
        })),
      );
    }
  }

  revalidatePath("/app");
  redirect(`/app/g/${group.id}`);
}

function collectPlaceholders(
  ruleSet: { parameters: unknown }[],
): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string" && v.startsWith("__") && v.endsWith("__")) {
      found.add(v.slice(2, -2));
      return;
    }
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(ruleSet.map((r) => r.parameters));
  return [...found];
}

// ---------------------------------------------------------------------------
// Rule CRUD
// ---------------------------------------------------------------------------

const ruleCreateSchema = z.object({
  groupId: z.string().uuid(),
  ruleJson: z.string(),
});

export async function createRule(formData: FormData) {
  const groupId = formData.get("groupId") as string;
  await requireMembership(groupId);

  const session = await auth();
  const ruleJson = formData.get("ruleJson") as string;
  ruleCreateSchema.parse({ groupId, ruleJson });

  let parsed: unknown;
  try {
    parsed = JSON.parse(ruleJson);
  } catch {
    throw new Error("Rule JSON is not valid JSON.");
  }

  const rule = ruleSchema.parse(parsed);

  await db.insert(rules).values({
    groupId,
    name: rule.name,
    splitType: rule.splitType,
    parameters: rule.parameters,
    appliesToCategories: rule.appliesToCategories,
    priority: rule.priority,
    createdBy: session?.user?.id,
  });

  revalidatePath(`/app/g/${groupId}/rules`);
}

export async function deleteRule(formData: FormData) {
  const groupId = formData.get("groupId") as string;
  const ruleId = formData.get("ruleId") as string;
  await requireMembership(groupId);
  await db.delete(rules).where(eq(rules.id, ruleId));
  revalidatePath(`/app/g/${groupId}/rules`);
}

export async function updateRulePriority(formData: FormData) {
  const groupId = formData.get("groupId") as string;
  const ruleId = formData.get("ruleId") as string;
  const priority = Number(formData.get("priority"));
  await requireMembership(groupId);
  await db
    .update(rules)
    .set({ priority, updatedAt: new Date() })
    .where(eq(rules.id, ruleId));
  revalidatePath(`/app/g/${groupId}/rules`);
}

// ---------------------------------------------------------------------------
// Rule finder result -> rule set
// ---------------------------------------------------------------------------

export async function applyRuleFinderResult(formData: FormData) {
  const groupId = formData.get("groupId") as string;
  await requireMembership(groupId);

  const session = await auth();
  const payload = JSON.parse(formData.get("payload") as string) as {
    rules: Rule[];
  };

  // Replace any existing active rules (this is what "save my finder answers" does).
  await db.delete(rules).where(eq(rules.groupId, groupId));

  for (const r of payload.rules) {
    ruleSchema.parse(r);
    await db.insert(rules).values({
      groupId,
      name: r.name,
      splitType: r.splitType,
      parameters: r.parameters,
      appliesToCategories: r.appliesToCategories,
      priority: r.priority,
      createdBy: session?.user?.id,
    });
  }

  revalidatePath(`/app/g/${groupId}/rules`);
  redirect(`/app/g/${groupId}/rules`);
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function createExpense(formData: FormData) {
  const groupId = formData.get("groupId") as string;
  const { userId } = await requireMembership(groupId);

  const [g] = await db.select().from(groups).where(eq(groups.id, groupId));
  if (!g) throw new Error("Group not found");

  const amount = stringToMinorUnits(
    (formData.get("amount") as string) || "0",
    g.currency,
  );
  const category = formData.get("category") as string;
  const description = (formData.get("description") as string) || undefined;
  const paidBy = formData.get("paidBy") as string; // either userId or ghostId
  const attendees = (formData.getAll("attendees") as string[]) || [];

  const participants = await loadGroupParticipants(groupId);
  const groupRules = await loadGroupRules(groupId);

  const split = applyRules({
    rules: groupRules,
    participants,
    expense: {
      amount,
      currency: g.currency,
      category,
      description,
      paidBy,
      attendees: attendees.length ? attendees : undefined,
    },
  });

  // Determine if paidBy is a real user or a ghost.
  const payer = participants.find((p) => p.id === paidBy);
  if (!payer) throw new Error("Unknown payer");

  const [exp] = await db
    .insert(expenses)
    .values({
      groupId,
      paidByUserId: payer.kind === "user" ? paidBy : null,
      paidByGhostId: payer.kind === "ghost" ? paidBy : null,
      amount,
      currency: g.currency,
      category,
      description,
      ruleId: split.ruleId,
    })
    .returning();

  for (const share of split.shares) {
    const who = participants.find((p) => p.id === share.participantId);
    if (!who) continue;
    await db.insert(expenseParticipants).values({
      expenseId: exp.id,
      userId: who.kind === "user" ? who.id : null,
      ghostUserId: who.kind === "ghost" ? who.id : null,
      shareAmount: share.shareAmount,
      isExempt: share.isExempt,
      exceptionReason: share.reason,
    });
  }

  // If the matched rule was rotating, advance the index.
  if (split.ruleId) {
    const [matched] = await db
      .select()
      .from(rules)
      .where(eq(rules.id, split.ruleId));
    if (matched && matched.splitType === "rotating") {
      const params = matched.parameters as {
        rotationOrder: string[];
        currentIndex: number;
      };
      const next =
        (params.currentIndex + 1) % Math.max(params.rotationOrder.length, 1);
      await db
        .update(rules)
        .set({
          parameters: { ...params, currentIndex: next },
          updatedAt: new Date(),
        })
        .where(eq(rules.id, matched.id));
    }
  }

  revalidatePath(`/app/g/${groupId}`);
  redirect(`/app/g/${groupId}/expenses/${exp.id}`);
}

export async function deleteExpense(formData: FormData) {
  const groupId = formData.get("groupId") as string;
  const expenseId = formData.get("expenseId") as string;
  await requireMembership(groupId);
  await db.delete(expenses).where(eq(expenses.id, expenseId));
  revalidatePath(`/app/g/${groupId}`);
}

function randomCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}
