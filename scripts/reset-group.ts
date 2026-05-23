/**
 * Dev-only admin utility: reset one group back to a members-only shell.
 *
 * Deletes expenses, expense participants (via cascade), settlements, and rules
 * for a group id. Keeps the group row, real members, and ghost members.
 *
 * Usage:
 *   npm run admin:reset-group -- <group-id> --yes
 *
 * Refuses to run with NODE_ENV=production unless ALLOW_PROD_ADMIN_SCRIPT=1.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";

import * as schema from "../src/db/schema";

function groupIdFromArgs(): string | null {
  const groupIdFlag = process.argv.indexOf("--group-id");
  if (groupIdFlag >= 0) return process.argv[groupIdFlag + 1] ?? null;

  return process.argv
    .slice(2)
    .find((arg) => !arg.startsWith("--")) ?? null;
}

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PROD_ADMIN_SCRIPT !== "1"
  ) {
    throw new Error(
      "Refusing to run with NODE_ENV=production. Set ALLOW_PROD_ADMIN_SCRIPT=1 only if you truly intend this.",
    );
  }

  const groupId = groupIdFromArgs();
  const confirmed = process.argv.includes("--yes");

  if (!groupId || !confirmed) {
    console.error("Usage: npm run admin:reset-group -- <group-id> --yes");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool, { schema });

  try {
    const [group] = await db
      .select({ id: schema.groups.id, name: schema.groups.name })
      .from(schema.groups)
      .where(eq(schema.groups.id, groupId))
      .limit(1);

    if (!group) throw new Error(`Group not found: ${groupId}`);

    const result = await db.transaction(async (tx) => {
      const deletedSettlements = await tx
        .delete(schema.settlements)
        .where(eq(schema.settlements.groupId, groupId))
        .returning({ id: schema.settlements.id });

      const deletedExpenses = await tx
        .delete(schema.expenses)
        .where(eq(schema.expenses.groupId, groupId))
        .returning({ id: schema.expenses.id });

      const deletedRules = await tx
        .delete(schema.rules)
        .where(eq(schema.rules.groupId, groupId))
        .returning({ id: schema.rules.id });

      return {
        settlements: deletedSettlements.length,
        expenses: deletedExpenses.length,
        rules: deletedRules.length,
      };
    });

    console.log(`Reset group "${group.name}" (${group.id}).`);
    console.log(`Deleted ${result.expenses} expenses.`);
    console.log(`Deleted ${result.settlements} settlements.`);
    console.log(`Deleted ${result.rules} rules.`);
    console.log("Members and ghost access codes were kept.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
