import "server-only";
import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let database: ReturnType<typeof createDatabase> | undefined;
function createDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required.");
  const pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 });
  attachDatabasePool(pool);
  return drizzle(pool, { schema });
}

export function getDb() {
  // Next.js evaluates modules while building; connect only for an actual query.
  return database ??= createDatabase();
}
