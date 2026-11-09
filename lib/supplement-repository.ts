import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { supplementJournals,userStates } from "@/db/schema";
import { stateSchema } from "./model";
import { SupplementInputError,emptySupplementJournal,supplementJournalSchema } from "./supplement-journal";
import type { SupplementRepository } from "./supplement-api";
export const supplementRepository:SupplementRepository={
  async read(userId){const [row]=await getDb().select().from(supplementJournals).where(eq(supplementJournals.userId,userId));return {journal:row?supplementJournalSchema.parse(JSON.parse(row.payload)):emptySupplementJournal(),revision:row?.revision??0};},
  async mutate(userId,revision,apply){return getDb().transaction(async tx=>{
    const [account]=await tx.select().from(userStates).where(eq(userStates.userId,userId)).for("update");if(!account)throw new SupplementInputError("기초 프로필을 먼저 저장해주세요.");
    const [row]=await tx.select().from(supplementJournals).where(eq(supplementJournals.userId,userId));if((row?.revision??0)!==revision)return null;
    const journal=apply(row?supplementJournalSchema.parse(JSON.parse(row.payload)):emptySupplementJournal(),stateSchema.parse(JSON.parse(account.payload))),values={payload:JSON.stringify(journal),revision:revision+1,updatedAt:new Date().toISOString()};
    if(row)await tx.update(supplementJournals).set(values).where(eq(supplementJournals.userId,userId));else await tx.insert(supplementJournals).values({userId,...values});
    return {journal,revision:values.revision};
  });},
};
