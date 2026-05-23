/**
 * Dev-only admin utility: dump a user's Faircutter data as JSON.
 *
 * Intended as a future GDPR-readiness helper. Exports the user row, their
 * memberships, groups they created or joined, group members, ghosts, rules,
 * expenses, expense participant rows, and settlements for those groups.
 *
 * Usage:
 *   npm run admin:dump-user -- --email person@example.com
 *   npm run admin:dump-user -- --user-id <uuid> --out /tmp/user-export.json
 *
 * Refuses to run with NODE_ENV=production unless ALLOW_PROD_ADMIN_SCRIPT=1.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { writeFileSync } from "fs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray, or } from "drizzle-orm";

import * as schema from "../src/db/schema";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
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

  const email = argValue("--email");
  const userIdArg = argValue("--user-id");
  const outPath = argValue("--out");

  if (!email && !userIdArg) {
    console.error(
      "Usage: npm run admin:dump-user -- --email person@example.com [--out /tmp/user-export.json]",
    );
    process.exit(1);
  }

  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");

  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool, { schema });

  try {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(
        userIdArg
          ? eq(schema.users.id, userIdArg)
          : eq(schema.users.email, email as string),
      )
      .limit(1);

    if (!user) {
      throw new Error(
        userIdArg ? `User not found: ${userIdArg}` : `User not found: ${email}`,
      );
    }

    const memberships = await db
      .select()
      .from(schema.groupMembers)
      .where(eq(schema.groupMembers.userId, user.id));

    const createdGroups = await db
      .select()
      .from(schema.groups)
      .where(eq(schema.groups.createdBy, user.id));

    const groupIds = [
      ...new Set([
        ...memberships.map((membership) => membership.groupId),
        ...createdGroups.map((group) => group.id),
      ]),
    ];

    const [
      groups,
      groupMembers,
      ghostUsers,
      rules,
      expenses,
      settlements,
    ] =
      groupIds.length > 0
        ? await Promise.all([
            db
              .select()
              .from(schema.groups)
              .where(inArray(schema.groups.id, groupIds)),
            db
              .select()
              .from(schema.groupMembers)
              .where(inArray(schema.groupMembers.groupId, groupIds)),
            db
              .select()
              .from(schema.ghostUsers)
              .where(inArray(schema.ghostUsers.groupId, groupIds)),
            db
              .select()
              .from(schema.rules)
              .where(inArray(schema.rules.groupId, groupIds)),
            db
              .select()
              .from(schema.expenses)
              .where(inArray(schema.expenses.groupId, groupIds)),
            db
              .select()
              .from(schema.settlements)
              .where(inArray(schema.settlements.groupId, groupIds)),
          ])
        : [[], [], [], [], [], []];

    const expenseIds = expenses.map((expense) => expense.id);
    const expenseParticipants =
      expenseIds.length > 0
        ? await db
            .select()
            .from(schema.expenseParticipants)
            .where(inArray(schema.expenseParticipants.expenseId, expenseIds))
        : [];

    const userExpenseRows =
      groupIds.length > 0
        ? await db
            .select()
            .from(schema.expenses)
            .where(
              or(
                eq(schema.expenses.paidByUserId, user.id),
                inArray(schema.expenses.groupId, groupIds),
              ),
            )
        : [];

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      user,
      memberships,
      groups,
      groupMembers,
      ghostUsers,
      rules,
      expenses,
      expenseParticipants,
      settlements,
      userExpenseRows,
    };

    const json = `${JSON.stringify(exportPayload, null, 2)}\n`;
    if (outPath) {
      writeFileSync(outPath, json);
      console.log(`Wrote user export for ${user.email} to ${outPath}`);
    } else {
      process.stdout.write(json);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
