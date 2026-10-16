import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

if (!process.env.DATABASE_URL_UNPOOLED) throw new Error("DATABASE_URL_UNPOOLED is required for migrations.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL_UNPOOLED, max: 1, connectionTimeoutMillis: 10000 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Database migrations completed.");
} catch {
  // Provider errors can contain credentials or connection details.
  console.error("Database migration failed. Check the configured development database and migration files.");
  process.exitCode = 1;
} finally { await pool.end(); }
