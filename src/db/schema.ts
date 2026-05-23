/**
 * Faircutter database schema.
 *
 * Conventions:
 *  - UUIDs for all primary keys (portable, predictable, opaque).
 *  - Money stored as integer minor units (cents) on every amount column —
 *    never floats. The currency code lives on the group, not the amount.
 *  - `ghostUserId` foreign keys mirror `userId` foreign keys so unregistered
 *    participants are first-class members of a group. Exactly one of
 *    (user_id, ghost_user_id) is set on tables that point to "a person".
 *  - Rule parameters and template definitions are JSONB for flexibility; the
 *    canonical TS discriminated unions live in src/rules/types.ts.
 */
import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
  uuid,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

// ============================================================================
// Auth tables (NextAuth / Auth.js v5 with Drizzle adapter)
// ============================================================================

export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("passwordHash"),

  // Optional profile data (surfaced in /app/settings).
  declaredIncome: integer("declaredIncome"), // minor units, monthly
  preferredCurrency: text("preferredCurrency").default("USD").notNull(),
  language: text("language").default("en").notNull(),
  // V2-relevant: pay schedule for payday-aware suggestions.
  paySchedule: text("paySchedule"), // "monthly" | "biweekly" | "weekly" | null
  payAnchorDate: timestamp("payAnchorDate", { mode: "date" }),

  // Optional opt-in for anonymized data sharing (Phase 4 product).
  dataSharingOptIn: boolean("dataSharingOptIn").default(false).notNull(),

  createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: uuid("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ============================================================================
// Groups (households, trips, one-time groups)
// ============================================================================

export const groupTypeEnum = pgEnum("group_type", [
  "household",
  "trip",
  "one_time",
  "couple",
]);

export const groupStatusEnum = pgEnum("group_status", [
  "active",
  "archived",
  "settled",
]);

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: groupTypeEnum("type").notNull().default("household"),
  status: groupStatusEnum("status").notNull().default("active"),
  currency: text("currency").notNull().default("USD"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  archivedAt: timestamp("archived_at", { mode: "date" }),
});

// ============================================================================
// Ghost users — non-registered participants identified by a one-time code.
// Anyone added to a group becomes a ghost user until/unless they claim the link.
// ============================================================================

export const ghostUsers = pgTable(
  "ghost_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    // One-time code used by /view/[code]. Indexed-unique for fast lookup.
    accessCode: text("access_code").notNull(),
    // Optional email — if set, we email balance reminders (humans only push it).
    email: text("email"),
    declaredIncome: integer("declared_income"), // minor units, monthly
    // If the ghost upgrades to a real account, claimedByUserId is set and
    // expense participation rows are re-pointed.
    claimedByUserId: uuid("claimed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    claimedAt: timestamp("claimed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("ghost_users_access_code_idx").on(t.accessCode),
    index("ghost_users_group_idx").on(t.groupId),
  ],
);

// ============================================================================
// Group members — links users OR ghost users to groups.
// Exactly one of (user_id, ghost_user_id) is set.
// ============================================================================

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "member",
  "viewer",
]);

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    ghostUserId: uuid("ghost_user_id").references(() => ghostUsers.id, {
      onDelete: "cascade",
    }),
    role: memberRoleEnum("role").notNull().default("member"),
    // Snapshot of declared income at the time of joining — used by by_income
    // rules so changes to a user's profile income don't retroactively rewrite
    // every old split.
    incomeSnapshot: integer("income_snapshot"),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
    leftAt: timestamp("left_at", { mode: "date" }),
  },
  (t) => [
    index("group_members_group_idx").on(t.groupId),
    index("group_members_user_idx").on(t.userId),
    index("group_members_ghost_idx").on(t.ghostUserId),
    // Enforce: exactly one of userId, ghostUserId.
    // Drizzle doesn't have a native CHECK builder yet, so we'll add this in a
    // raw migration if needed. Application-level invariant for now.
  ],
);

// ============================================================================
// Rules — first-class, reusable, ordered.
// ============================================================================

export const splitTypeEnum = pgEnum("split_type", [
  "equal",
  "percentage",
  "fixed_amount",
  "by_income",
  "itemized",
  "weighted",
  "usage_based",
  "exempt",
  "rotating",
  "subsidized",
]);

export const rules = pgTable(
  "rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Either group-scoped (most common) or user-scoped (personal rule library).
    groupId: uuid("group_id").references(() => groups.id, {
      onDelete: "cascade",
    }),
    ownerId: uuid("owner_id").references(() => users.id, {
      onDelete: "cascade",
    }),

    name: text("name").notNull(),
    description: text("description"),
    splitType: splitTypeEnum("split_type").notNull(),

    // Parameters per split type. Validated against the discriminated union in
    // src/rules/types.ts on write.
    parameters: jsonb("parameters").notNull().default(sql`'{}'::jsonb`),

    // Array of category strings this rule applies to. Empty array = all.
    appliesToCategories: jsonb("applies_to_categories")
      .notNull()
      .default(sql`'[]'::jsonb`)
      .$type<string[]>(),

    // Lower number = higher priority. First matching rule wins.
    priority: integer("priority").notNull().default(100),

    isTemplate: boolean("is_template").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),

    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("rules_group_idx").on(t.groupId),
    index("rules_owner_idx").on(t.ownerId),
    index("rules_priority_idx").on(t.groupId, t.priority),
  ],
);

// ============================================================================
// Templates — pre-built rule sets, instantiated into a new group.
// ============================================================================

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  appliesTo: text("applies_to").notNull(), // "couple" | "roommates" | "household" | "trip"
  // The full rule set as an array of rule definitions. Each is the same shape
  // as `rules.parameters` plus metadata. Materialized into real `rules` rows
  // when applied to a group.
  ruleSet: jsonb("rule_set").notNull().$type<TemplateRuleDef[]>(),
  // Suggested group members for the seeded scenario (used by /seed only).
  suggestedMembers: jsonb("suggested_members")
    .notNull()
    .default(sql`'[]'::jsonb`)
    .$type<{ displayName: string; declaredIncome?: number }[]>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export type TemplateRuleDef = {
  name: string;
  description?: string;
  splitType: string;
  parameters: Record<string, unknown>;
  appliesToCategories: string[];
  priority: number;
};

// ============================================================================
// Rule fragments — for the autocomplete/autofill rule finder (Phase 2 AI hook).
// ============================================================================

export const ruleFragments = pgTable("rule_fragments", {
  id: uuid("id").primaryKey().defaultRandom(),
  triggerText: text("trigger_text").notNull(),
  displayLabel: text("display_label").notNull(),
  ruleMapping: jsonb("rule_mapping").notNull(),
  language: text("language").notNull().default("en"),
});

// ============================================================================
// Expenses
// ============================================================================

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),

    // Who paid. Exactly one of paidByUserId / paidByGhostId.
    paidByUserId: uuid("paid_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    paidByGhostId: uuid("paid_by_ghost_id").references(() => ghostUsers.id, {
      onDelete: "set null",
    }),

    amount: integer("amount").notNull(), // minor units
    currency: text("currency").notNull(), // denormalized for safety; should match group
    category: text("category").notNull(),
    description: text("description"),

    // The rule that was applied. Null only if expense was hand-split with no rule.
    ruleId: uuid("rule_id").references(() => rules.id, { onDelete: "set null" }),

    occurredAt: timestamp("occurred_at", { mode: "date" }).defaultNow().notNull(),
    dueDate: timestamp("due_date", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("expenses_group_idx").on(t.groupId),
    index("expenses_occurred_idx").on(t.groupId, t.occurredAt),
    index("expenses_rule_idx").on(t.ruleId),
  ],
);

// ============================================================================
// Expense participants — per-person share for a single expense.
// ============================================================================

export const expenseParticipants = pgTable(
  "expense_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expenseId: uuid("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    ghostUserId: uuid("ghost_user_id").references(() => ghostUsers.id, {
      onDelete: "cascade",
    }),
    shareAmount: integer("share_amount").notNull(), // minor units
    isExempt: boolean("is_exempt").notNull().default(false),
    exceptionReason: text("exception_reason"),
  },
  (t) => [
    index("ep_expense_idx").on(t.expenseId),
    index("ep_user_idx").on(t.userId),
    index("ep_ghost_idx").on(t.ghostUserId),
  ],
);

// ============================================================================
// Settlements — pairwise payments marked as made.
// ============================================================================

export const settlementTypeEnum = pgEnum("settlement_type", [
  "manual",          // launch: user marked as paid
  "smart_netted",    // V2: minimum-transactions
  "subgroup_netted", // V2: trip-within-roommates
]);

export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    fromUserId: uuid("from_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    fromGhostId: uuid("from_ghost_id").references(() => ghostUsers.id, {
      onDelete: "set null",
    }),
    toUserId: uuid("to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    toGhostId: uuid("to_ghost_id").references(() => ghostUsers.id, {
      onDelete: "set null",
    }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    note: text("note"),
    settlementType: settlementTypeEnum("settlement_type")
      .notNull()
      .default("manual"),
    markedPaidAt: timestamp("marked_paid_at", { mode: "date" })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("settlements_group_idx").on(t.groupId),
    index("settlements_from_idx").on(t.fromUserId, t.fromGhostId),
    index("settlements_to_idx").on(t.toUserId, t.toGhostId),
  ],
);

// ============================================================================
// Balances — DERIVED VIEW. Not materialized at launch; computed on read.
// Schema kept here only as a note: balances are (groupId × pair-of-people) →
// net amount in minor units. If query cost becomes a problem we'll add a
// materialized view in a later migration.
// ============================================================================

// ============================================================================
// Relations (for typed joins via Drizzle relational queries)
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  groupsCreated: many(groups),
  memberships: many(groupMembers),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, {
    fields: [groups.createdBy],
    references: [users.id],
  }),
  members: many(groupMembers),
  rules: many(rules),
  expenses: many(expenses),
  settlements: many(settlements),
  ghostUsers: many(ghostUsers),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMembers.userId],
    references: [users.id],
  }),
  ghost: one(ghostUsers, {
    fields: [groupMembers.ghostUserId],
    references: [ghostUsers.id],
  }),
}));

export const rulesRelations = relations(rules, ({ one, many }) => ({
  group: one(groups, {
    fields: [rules.groupId],
    references: [groups.id],
  }),
  expenses: many(expenses),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  group: one(groups, {
    fields: [expenses.groupId],
    references: [groups.id],
  }),
  rule: one(rules, {
    fields: [expenses.ruleId],
    references: [rules.id],
  }),
  paidByUser: one(users, {
    fields: [expenses.paidByUserId],
    references: [users.id],
  }),
  paidByGhost: one(ghostUsers, {
    fields: [expenses.paidByGhostId],
    references: [ghostUsers.id],
  }),
  participants: many(expenseParticipants),
}));

export const expenseParticipantsRelations = relations(
  expenseParticipants,
  ({ one }) => ({
    expense: one(expenses, {
      fields: [expenseParticipants.expenseId],
      references: [expenses.id],
    }),
    user: one(users, {
      fields: [expenseParticipants.userId],
      references: [users.id],
    }),
    ghost: one(ghostUsers, {
      fields: [expenseParticipants.ghostUserId],
      references: [ghostUsers.id],
    }),
  }),
);

export const ghostUsersRelations = relations(ghostUsers, ({ one, many }) => ({
  group: one(groups, {
    fields: [ghostUsers.groupId],
    references: [groups.id],
  }),
  claimedBy: one(users, {
    fields: [ghostUsers.claimedByUserId],
    references: [users.id],
  }),
  memberships: many(groupMembers),
}));
