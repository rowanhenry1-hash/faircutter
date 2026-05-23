import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED (or DATABASE_URL) must be set");

  const pool = new Pool({ connectionString: url, max: 1 });
  const db = drizzle(pool);

  console.log("Running migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
