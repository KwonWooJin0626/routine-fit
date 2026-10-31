import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { userStates } from "../db/schema";
import { createStateHandlers, type StateRepository } from "../lib/state-api";
import { defaultAnswers, defaultSchedule, initialCheckin, localDate, stateSchema, type AppState } from "../lib/model";
import { emptyBasicProfile } from "../lib/basic-profile";
import { checkpointActivity } from "../lib/activity-checkpoint";
import { newActivityProfile } from "../lib/activity-profile";
import { buildDay } from "../lib/engine";

const id=`qa_activity_${randomUUID()}`,db=getDb();
const repository:StateRepository={
  get:async userId=>(await db.select().from(userStates).where(eq(userStates.userId,userId)).limit(1))[0]??null,
  save:async(userId,payload,revision)=>{
    const values={payload,updatedAt:new Date().toISOString(),revision:revision+1};
    const rows=revision===0?await db.insert(userStates).values({...values,userId}).onConflictDoNothing().returning({revision:userStates.revision}):await db.update(userStates).set(values).where(and(eq(userStates.userId,userId),eq(userStates.revision,revision))).returning({revision:userStates.revision});
    return rows[0]?.revision??null;
  },remove:async userId=>{await db.delete(userStates).where(eq(userStates.userId,userId));},
};
try{
  const date=localDate(),weekday=new Date(`${date}T12:00Z`).getUTCDay();
  const profile={...newActivityProfile("reading"),goal:"habit",activity:"read",current:"regular" as const,daily:20,weekly:20,days:[weekday],fields:{hasBook:"yes",genre:"existing",format:"ebook",book:"합성 검증용",record:"summary"}};
  const answers={...defaultAnswers,name:"검증 예시",basic:emptyBasicProfile(),activities:checkpointActivity(undefined,profile,["reading","exercise"],"routine")};
  const day=buildDay(answers,initialCheckin(answers),"core",defaultSchedule,[],undefined,date),routine=day.routines[0];
  day.statuses[routine.id]="partial";day.activityFeedback={[routine.id]:{actualMinutes:7,reason:"time",recordedAt:new Date().toISOString()}};
  const state:AppState={version:1,consentVersion:"2026-10-growth-v1",consentAt:new Date().toISOString(),answers,schedule:defaultSchedule,days:[day],inbody:[]};
  const api=createStateHandlers(async()=>id,repository),other=createStateHandlers(async()=>`${id}_other`,repository);
  const request=(revision:number)=>new Request("https://routine.test/api/state",{method:"PUT",headers:{origin:"https://routine.test"},body:JSON.stringify({state,revision})});
  assert.equal((await api.PUT(request(0))).status,200);assert.equal((await api.PUT(request(0))).status,409);
  const result=await (await api.GET()).json();assert.equal(result.state.answers.activities.profiles[0].fields.book,profile.fields.book);assert.equal(result.state.days[0].activityFeedback[routine.id].actualMinutes,7);
  assert.equal((await (await other.GET()).json()).state,null);assert.deepEqual(result.state.answers.activities.pendingDomains,["exercise"]);
  const exercise={...newActivityProfile("exercise"),goal:"habit",activity:"home",current:"regular" as const,daily:20,weekly:20,days:[weekday],fields:{interest:"home",place:"home",experience:"first",restriction:"wrist",equipment:"mat,band",noise:"no",overhead:"0"}};
  state.answers.activities=checkpointActivity(result.state.answers.activities,exercise,["reading","exercise"],"routine");
  assert.equal((await api.PUT(request(1))).status,200);
  const resumed=await (await api.GET()).json();assert.deepEqual(resumed.state.answers.activities.pendingDomains,[]);assert.equal(stateSchema.parse(resumed.state).answers.activities!.profiles.find(p=>p.domain==="exercise")!.fields.equipment,"mat,band");assert.equal(resumed.state.days[0].activityFeedback[routine.id].actualMinutes,7);
  console.log("Activity DB integration passed: profile + routine + explicit actual minutes round-trip, revision CAS, account isolation.");
}finally{await repository.remove(id);await db.$client.end();}
