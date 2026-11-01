import { eq, and } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/db";
import { userStates,petCompanions } from "@/db/schema";
import { stateSchema } from "@/lib/model";
import { protectsPetRecords } from "@/lib/pet-actions";
import { readPetDocument } from "@/lib/pet-repository";
import { createStateHandlers, type StateRepository } from "@/lib/state-api";
import { syncStoredRecommendations } from "@/lib/recommendation-repository";

const repository: StateRepository = {
  async get(userId) {
    const rows = await getDb().select().from(userStates).where(eq(userStates.userId, userId)).limit(1);
    return rows[0] ?? null;
  },
  async save(userId, payload, expectedRevision,intent) {
    const db = getDb();
    const updatedAt = new Date().toISOString();
    if (expectedRevision === 0) {
      return db.transaction(async tx=>{const rows = await tx.insert(userStates).values({ userId, payload, updatedAt, revision: 1 }).onConflictDoNothing().returning({ revision: userStates.revision });if(rows[0])await syncStoredRecommendations(tx,userId,null,stateSchema.parse(JSON.parse(payload)),intent);return rows[0]?.revision??null;});
    }
    return db.transaction(async tx=>{
      const [old]=await tx.select().from(userStates).where(eq(userStates.userId,userId)).for("update");
      if(!old||old.revision!==expectedRevision)return null;
      const [pet]=await tx.select().from(petCompanions).where(eq(petCompanions.userId,userId));
      if(!protectsPetRecords(stateSchema.parse(JSON.parse(old.payload)),stateSchema.parse(JSON.parse(payload)),pet?readPetDocument(pet.payload):null))return null;
      const rows=await tx.update(userStates).set({payload,updatedAt,revision:expectedRevision+1}).where(and(eq(userStates.userId,userId),eq(userStates.revision,expectedRevision))).returning({revision:userStates.revision});
      if(rows[0])await syncStoredRecommendations(tx,userId,stateSchema.parse(JSON.parse(old.payload)),stateSchema.parse(JSON.parse(payload)),intent);
      return rows[0]?.revision??null;
    });
  },
  async remove(userId) { await getDb().delete(userStates).where(eq(userStates.userId, userId)); },
};

const handlers = createStateHandlers(async () => (await getSessionUser())?.userId ?? null, repository);
export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
