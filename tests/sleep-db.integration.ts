import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { userStates,sleepDeliveries,sleepProfiles,sleepRecords } from "../db/schema";
import { sleepRepository } from "../lib/sleep-repository";
import { defaultSleepSettings,koreanDate } from "../lib/sleep";
import { signSleepToken } from "../lib/sleep-token";

const id=`qa_sleep_${randomUUID()}`,db=getDb(),now=new Date(),date=koreanDate(now);
process.env.SLEEP_TOKEN_SECRET=`test-${randomUUID()}`;
try{
  await db.insert(userStates).values({userId:id,payload:"{}",revision:1,updatedAt:now.toISOString()});
  assert.equal((await sleepRepository.settings(id,"synthetic@example.test",{...defaultSleepSettings(),emailEnabled:true},0))?.revision,1);
  assert.equal(await sleepRepository.settings(id,"synthetic@example.test",defaultSleepSettings(),0),null);
  const deliveryId=`qa-delivery-${randomUUID()}`;
  await db.insert(sleepDeliveries).values({id:deliveryId,userId:id,revision:1,sessionDate:date,kind:"wake",plannedAt:now.toISOString(),status:"sent",attemptedAt:now.toISOString()});
  const token=signSleepToken({userId:id,deliveryId,revision:1,sessionDate:date,kind:"wake",expires:Date.now()+60000},process.env.SLEEP_TOKEN_SECRET);
  assert.equal(await sleepRepository.emailCheckin("other-account",token,now),null);
  const first=await sleepRepository.emailCheckin(id,token,now);assert.ok(first);assert.equal(first.actualAt,null);
  assert.equal(await sleepRepository.emailCheckin(id,token,now),null);
  const direct=await sleepRepository.checkin(id,{...first,checkedAt:new Date(now.getTime()+60000).toISOString()});assert.equal(direct.checkedAt,first.checkedAt);
  assert.equal((await sleepRepository.correct(id,first.id,new Date(now.getTime()-60000).toISOString(),now.toISOString()))?.checkedAt,first.checkedAt);
  assert.equal((await sleepRepository.get(id)).records.length,1);
  await db.delete(userStates).where(eq(userStates.userId,id));
  for(const table of [sleepProfiles,sleepDeliveries,sleepRecords])assert.equal((await db.select().from(table).where(eq(table.userId,id))).length,0);
  console.log("Sleep DB integration passed: settings CAS, account isolation, single-use confirmation, original timestamp, correction, cascade cleanup.");
}finally{
  await db.delete(userStates).where(eq(userStates.userId,id));
  await db.$client.end();
}
