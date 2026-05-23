/**
 * Faircutter database schema (Step 1: auth-only tables).
 *
 * Step 2 will append: groups, group_members, ghost_users, rules, expenses,
 * expense_participants, settlements, templates, rule_fragments.
 *
 * Tables here cover what NextAuth/Auth.js v5 with the Drizzle adapter requires,
 * plus a `passwordHash` column on `users` so we can support email+password
 * alongside magic-link sign-in.
 */
import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // Email+password support: bcrypt hash. Null for magic-link-only users.
  passwordHash: text("passwordHash"),
  // Optional fields surfaced in /app/settings (Step 9).
  declaredIncome: integer("declaredIncome"),
  preferredCurrency: text("preferredCurrency").default("USD").notNull(),
  language: text("language").default("en").notNull(),
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
