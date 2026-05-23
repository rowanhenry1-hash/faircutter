/**
 * Seed script — populate the dev DB with the 5 scenarios from BLUEPRINT.md
 * Section 2, plus the 5 launch templates.
 *
 * Usage: npm run db:seed
 *
 * Re-running is destructive for seeded data only (it deletes obviously
 * fictional users and their groups by email pattern). Real user data is left
 * alone.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, like, or } from "drizzle-orm";
import bcrypt from "bcryptjs";

import * as schema from "./schema";
import { TEMPLATES, bindTemplate } from "@/rules/templates";
import type { SplitType } from "@/rules/types";

const SEED_EMAIL_DOMAIN = "@seed.faircutter.dev";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool, { schema });

  console.log("Wiping previous seed data…");
  await db.delete(schema.users).where(like(schema.users.email, `%${SEED_EMAIL_DOMAIN}`));
  // groups, ghosts, rules, expenses cascade off users via createdBy / members.
  // But ghosts that belonged to deleted groups already cascade; templates do
  // not depend on users so we wipe + re-insert them explicitly.
  await db.delete(schema.templates);
  await db.delete(schema.ruleFragments);

  console.log("Inserting templates…");
  await db.insert(schema.templates).values(
    TEMPLATES.map((t) => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      appliesTo: t.appliesTo,
      ruleSet: t.rules,
      suggestedMembers: t.suggestedMembers,
    })),
  );

  // ----- A founder user we always seed for dev convenience -------------
  const founderPassword = await bcrypt.hash("faircutter-dev", 10);
  const [founder] = await db
    .insert(schema.users)
    .values({
      name: "Dev Founder",
      email: `founder${SEED_EMAIL_DOMAIN}`,
      passwordHash: founderPassword,
      declaredIncome: 5000,
      preferredCurrency: "CAD",
    })
    .returning();
  console.log(`  Dev login: founder${SEED_EMAIL_DOMAIN} / faircutter-dev`);

  // ----- Helper: seed one scenario from a template ---------------------
  type SeedMember = {
    key: string;
    displayName: string;
    declaredIncome?: number;
  };

  async function seedScenario(args: {
    templateSlug: string;
    groupName: string;
    currency: string;
    members: SeedMember[];
    seedExpenses?: Array<{
      paidByKey: string;
      amount: number;
      category: string;
      description?: string;
      attendeeKeys?: string[];
    }>;
  }) {
    const template = TEMPLATES.find((t) => t.slug === args.templateSlug);
    if (!template) throw new Error(`Unknown template ${args.templateSlug}`);

    const [group] = await db
      .insert(schema.groups)
      .values({
        name: args.groupName,
        type: template.appliesTo === "trip" ? "trip" : "household",
        currency: args.currency,
        createdBy: founder.id,
      })
      .returning();

    // Ghost users (one per member) — seed scenarios don't have real users.
    const memberRows: { key: string; ghostId: string }[] = [];
    for (const m of args.members) {
      const accessCode = randomCode();
      const [ghost] = await db
        .insert(schema.ghostUsers)
        .values({
          groupId: group.id,
          displayName: m.displayName,
          accessCode,
          declaredIncome: m.declaredIncome,
        })
        .returning();
      await db.insert(schema.groupMembers).values({
        groupId: group.id,
        ghostUserId: ghost.id,
        role: "member",
        incomeSnapshot: m.declaredIncome,
      });
      memberRows.push({ key: m.key, ghostId: ghost.id });
    }

    // Bind the template's placeholder keys to real ghost ids.
    const keyMap: Record<string, string> = Object.fromEntries(
      memberRows.map((m) => [m.key, m.ghostId]),
    );
    const boundRules = bindTemplate(template.rules, keyMap);

    // rotating rules in templates ship with empty rotationOrder; fill it.
    for (const r of boundRules) {
      if (r.splitType === "rotating") {
        const params = r.parameters as { rotationOrder: string[]; currentIndex: number };
        if (params.rotationOrder.length === 0) {
          params.rotationOrder = memberRows.map((m) => m.ghostId);
        }
      }
    }

    await db.insert(schema.rules).values(
      boundRules.map((r) => ({
        groupId: group.id,
        name: r.name,
        description: r.description,
        splitType: r.splitType as SplitType,
        parameters: r.parameters,
        appliesToCategories: r.appliesToCategories,
        priority: r.priority,
        createdBy: founder.id,
      })),
    );

    // Seeded sample expenses — optional but useful for screenshots.
    for (const e of args.seedExpenses ?? []) {
      const paid = memberRows.find((m) => m.key === e.paidByKey);
      if (!paid) throw new Error(`unknown paidBy ${e.paidByKey}`);
      await db.insert(schema.expenses).values({
        groupId: group.id,
        paidByGhostId: paid.ghostId,
        amount: e.amount,
        currency: args.currency,
        category: e.category,
        description: e.description,
      });
    }

    console.log(`  Seeded group: ${args.groupName}  (id=${group.id})`);
  }

  console.log("Seeding 5 scenarios…");

  await seedScenario({
    templateSlug: "couple-two-incomes",
    groupName: "Alex & Sam",
    currency: "CAD",
    members: [
      { key: "alex", displayName: "Alex", declaredIncome: 7500 },
      { key: "sam", displayName: "Sam", declaredIncome: 4500 },
    ],
    seedExpenses: [
      { paidByKey: "alex", amount: 200000, category: "rent", description: "May rent" },
      { paidByKey: "sam", amount: 18000, category: "utilities", description: "Hydro" },
      { paidByKey: "alex", amount: 32000, category: "groceries", description: "Costco run" },
    ],
  });

  await seedScenario({
    templateSlug: "roommates-equal",
    groupName: "Three Roommates (equal)",
    currency: "CAD",
    members: [
      { key: "r1", displayName: "Riley" },
      { key: "r2", displayName: "Jordan" },
      { key: "r3", displayName: "Casey" },
    ],
    seedExpenses: [
      { paidByKey: "r1", amount: 270000, category: "rent" },
      { paidByKey: "r2", amount: 12000, category: "utilities" },
      { paidByKey: "r3", amount: 8000, category: "groceries" },
    ],
  });

  await seedScenario({
    templateSlug: "roommates-by-income",
    groupName: "Three Roommates (by income)",
    currency: "CAD",
    members: [
      { key: "p1", displayName: "Pat", declaredIncome: 6000 },
      { key: "p2", displayName: "Robin", declaredIncome: 5000 },
      { key: "p3", displayName: "Sky", declaredIncome: 4000 },
    ],
    seedExpenses: [
      { paidByKey: "p1", amount: 240000, category: "rent" },
      { paidByKey: "p2", amount: 14000, category: "utilities" },
      { paidByKey: "p3", amount: 9000, category: "groceries" },
      { paidByKey: "p1", amount: 1599, category: "subscriptions", description: "Netflix" },
    ],
  });

  await seedScenario({
    templateSlug: "parents-plus-adult-child",
    groupName: "The Family Household",
    currency: "CAD",
    members: [
      { key: "dad", displayName: "Dad", declaredIncome: 8000 },
      { key: "mom", displayName: "Mom", declaredIncome: 6000 },
      { key: "kid", displayName: "Kid", declaredIncome: 3500 },
    ],
    seedExpenses: [
      { paidByKey: "dad", amount: 250000, category: "rent", description: "Mortgage" },
      { paidByKey: "mom", amount: 10000, category: "internet" },
      { paidByKey: "dad", amount: 22000, category: "utilities", description: "Hydro+gas" },
      { paidByKey: "mom", amount: 28000, category: "groceries" },
    ],
  });

  await seedScenario({
    templateSlug: "group-trip",
    groupName: "Tokyo trip (4 people)",
    currency: "JPY",
    members: [
      { key: "a", displayName: "Aki" },
      { key: "b", displayName: "Ben" },
      { key: "c", displayName: "Cam" },
      { key: "d", displayName: "Dee" },
    ],
    seedExpenses: [
      { paidByKey: "a", amount: 80000, category: "hotel", description: "First night" },
      { paidByKey: "b", amount: 9000, category: "dining", description: "Izakaya dinner (Dee skipped)", attendeeKeys: ["a", "b", "c"] },
      { paidByKey: "c", amount: 5400, category: "transport", description: "Taxi to Shibuya" },
    ],
  });

  console.log("Done.");
  await pool.end();
}

function randomCode(): string {
  // 8-char base32-ish access code; collisions handled by retry in real signup
  // flow. Seed is small enough we don't bother.
  const alphabet = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
