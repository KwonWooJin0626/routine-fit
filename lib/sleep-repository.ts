import "server-only";
import { createHash } from "node:crypto";
import { and,eq,lt,desc } from "drizzle-orm";
import { getDb } from "@/db";
import { sleepProfiles,sleepRecords,sleepDeliveries } from "@/db/schema";
import { sleepSettingsSchema,koreanDate,shiftDate,type SleepRecord } from "./sleep";
import { readSleepToken } from "./sleep-token";
import type { SleepRepository } from "./sleep-api";

const recordId=(userId:string,date:string,kind:string)=>createHash("sha256").update(`${userId}:${date}:${kind}`).digest("hex");
function record(row:typeof sleepRecords.$inferSelect):SleepRecord{return {id:row.id,sessionDate:row.sessionDate,kind:row.kind as SleepRecord["kind"],plannedAt:row.plannedAt,checkedAt:row.checkedAt,actualAt:row.actualAt,method:row.method as SleepRecord["method"],updatedAt:row.updatedAt};}
export const sleepRepository:SleepRepository={
  async get(userId){
    const db=getDb(),cutoff=shiftDate(koreanDate(new Date()),-89);
    await db.delete(sleepRecords).where(and(eq(sleepRecords.userId,userId),lt(sleepRecords.sessionDate,cutoff)));
    await db.delete(sleepDeliveries).where(and(eq(sleepDeliveries.userId,userId),lt(sleepDeliveries.sessionDate,cutoff)));
    const [profiles,records]=await Promise.all([db.select().from(sleepProfiles).where(eq(sleepProfiles.userId,userId)).limit(1),db.select().from(sleepRecords).where(eq(sleepRecords.userId,userId)).orderBy(desc(sleepRecords.sessionDate)).limit(180)]);
    const p=profiles[0];return {profile:p?{settings:sleepSettingsSchema.parse(JSON.parse(p.settings)),revision:p.revision,email:p.email}:null,records:records.map(record)};
  },
  async settings(userId,email,settings,revision){
    const db=getDb(),values={settings:JSON.stringify(settings),email,updatedAt:new Date().toISOString(),revision:revision+1};
    const rows=revision===0?await db.insert(sleepProfiles).values({userId,...values}).onConflictDoNothing().returning():await db.update(sleepProfiles).set(values).where(and(eq(sleepProfiles.userId,userId),eq(sleepProfiles.revision,revision))).returning();
    return rows[0]?{settings,revision:rows[0].revision,email}:null;
  },
  async checkin(userId,value){
    const rows=await getDb().insert(sleepRecords).values({...value,id:recordId(userId,value.sessionDate,value.kind),userId}).onConflictDoNothing().returning();
    if(rows[0])return record(rows[0]);
    const old=await getDb().select().from(sleepRecords).where(and(eq(sleepRecords.id,recordId(userId,value.sessionDate,value.kind)),eq(sleepRecords.userId,userId))).limit(1);
    return record(old[0]);
  },
  async correct(userId,id,actualAt,now){const rows=await getDb().update(sleepRecords).set({actualAt,updatedAt:now}).where(and(eq(sleepRecords.userId,userId),eq(sleepRecords.id,id))).returning();return rows[0]?record(rows[0]):null;},
  async emailCheckin(userId,token,now){
    const secret=process.env.SLEEP_TOKEN_SECRET;if(!secret)return null;
    const claim=readSleepToken(token,secret,now.getTime());if(!claim||claim.userId!==userId)return null;
    return getDb().transaction(async tx=>{
      const profiles=await tx.select().from(sleepProfiles).where(eq(sleepProfiles.userId,userId)).for("update");
      const p=profiles[0];if(!p||p.revision!==claim.revision||!sleepSettingsSchema.parse(JSON.parse(p.settings)).emailEnabled)return null;
      const deliveries=await tx.update(sleepDeliveries).set({status:"confirmed"}).where(and(eq(sleepDeliveries.id,claim.deliveryId),eq(sleepDeliveries.userId,userId),eq(sleepDeliveries.revision,claim.revision),eq(sleepDeliveries.kind,claim.kind),eq(sleepDeliveries.sessionDate,claim.sessionDate),eq(sleepDeliveries.status,"sent"))).returning();
      const delivery=deliveries[0];if(!delivery||delivery.kind!==claim.kind||delivery.sessionDate!==claim.sessionDate)return null;
      const id=recordId(userId,claim.sessionDate,claim.kind),values={id,userId,sessionDate:claim.sessionDate,kind:claim.kind,plannedAt:delivery.plannedAt,checkedAt:now.toISOString(),actualAt:null,method:"email",updatedAt:now.toISOString()};
      const rows=await tx.insert(sleepRecords).values(values).onConflictDoNothing().returning();
      if(rows[0])return record(rows[0]);
      const old=await tx.select().from(sleepRecords).where(and(eq(sleepRecords.id,id),eq(sleepRecords.userId,userId))).limit(1);return old[0]?record(old[0]):null;
    });
  },
};
