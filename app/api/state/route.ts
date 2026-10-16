import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/db";
import { userStates } from "@/db/schema";
import { createStateHandlers, type StateRepository } from "@/lib/state-api";

const repository: StateRepository = {
  async get(userId) {
    const rows = await getDb().select().from(userStates).where(eq(userStates.userId, userId)).limit(1);
    return rows[0] ?? null;
  },
  async save(userId, payload, expectedRevision) {
    const db = getDb();
    const updatedAt = new Date().toISOString();
    if (expectedRevision === 0) {
      const rows = await db.insert(userStates).values({ userId, payload, updatedAt, revision: 1 })
        .onConflictDoNothing().returning({ revision: userStates.revision });
      return rows[0]?.revision ?? null;
    }
    const rows = await db.update(userStates).set({ payload, updatedAt, revision: expectedRevision + 1 })
      .where(and(eq(userStates.userId, userId), eq(userStates.revision, expectedRevision)))
      .returning({ revision: userStates.revision });
    return rows[0]?.revision ?? null;
  },
  async remove(userId) { await getDb().delete(userStates).where(eq(userStates.userId, userId)); },
};

const handlers = createStateHandlers(async () => (await getSessionUser())?.userId ?? null, repository);
export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
