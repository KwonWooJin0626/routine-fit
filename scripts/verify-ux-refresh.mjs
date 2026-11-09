// Disposable development identity only. Never writes production or real user data.
import assert from "node:assert/strict";
import { randomUUID,randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClerkClient } from "@clerk/backend";
import pg from "pg";
import { build } from "esbuild";
const prod=parseEnv(await readFile(".env.production.local","utf8"));
assert.ok(process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"));
assert.ok(process.env.DATABASE_URL&&process.env.DATABASE_URL!==prod.DATABASE_URL);
await build({entryPoints:["lib/model.ts"],bundle:true,platform:"node",format:"esm",outfile:"outputs/ux-model.mjs"});
const {defaultAnswers,defaultSchedule,localDate}=await import("../outputs/ux-model.mjs");
const clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY}),connection=new URL(process.env.DATABASE_URL);
connection.searchParams.set("sslmode","verify-full");
const pool=new pg.Pool({connectionString:connection.toString(),max:1}),origin="http://127.0.0.1:3000";
let user,session,stage="anonymous";
const request=async(path,method="GET",body,site=origin)=>fetch(origin+path,{method,headers:{origin:site,"Content-Type":"application/json",...(session?{Authorization:`Bearer ${(await clerk.sessions.getToken(session.id)).jwt}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});
const json=async(path,body)=>{const response=await request(path,"POST",body),data=await response.json();assert.equal(response.status,200,data.error);return data;};
try{
  assert.equal((await request("/api/pet")).status,401);
  stage="synthetic identity";
  user=await clerk.users.createUser({emailAddress:[`rf-ux-${randomUUID()}+clerk_test@example.com`],password:`${randomBytes(30).toString("base64url")}!aA1`,firstName:"Synthetic",lastName:"UX"});
  session=await clerk.sessions.createSession({userId:user.id});
  const yesterday=localDate(new Date(Date.now()-86400000));
  const block={id:randomUUID(),title:"합성 수업",category:"study",start:"09:00",end:"10:00",mental:3,physical:2,mentalSource:"default",physicalSource:"default",location:"",task:"",shade:1,kind:"once",date:yesterday,weekdays:[],excludedDates:[]};
  const state={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-growth-v1",answers:{...defaultAnswers,name:"합성 UX 검증"},schedule:defaultSchedule,days:[],inbody:[],planner:{setupComplete:true,blocks:[block],templates:[]}};
  stage="profile";assert.equal((await request("/api/state","PUT",{state,revision:0})).status,200);
  const command={action:"record",record:{title:block.title,type:"study",start:new Date(`${yesterday}T09:00:00+09:00`).toISOString(),end:new Date(`${yesterday}T10:00:00+09:00`).toISOString(),source:{kind:"planner",id:block.id,date:yesterday},intensity:"moderate",status:"done"}};
  const input={key:randomUUID(),revision:0,appRevision:1,command};
  stage="human execution without pet";let result=await json("/api/pet",input);
  assert.equal(result.document,null);assert.equal(result.app.activityJournal.records.length,1);assert.equal(result.app.planner.records[0].status,"done");assert.equal(result.reactionId,undefined);
  const duplicate=await json("/api/pet",input);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.appRevision,result.appRevision);
  let loaded=await (await request("/api/state")).json();assert.deepEqual(loaded.state.activityJournal,result.app.activityJournal);
  stage="Neon restoration";const stored=await pool.query("SELECT payload FROM user_states WHERE user_id=$1",[user.id]);assert.deepEqual(JSON.parse(stored.rows[0].payload).activityJournal,loaded.state.activityJournal);
  stage="tampering and stale writes";
  assert.equal((await request("/api/state","PUT",{state:{...loaded.state,activityJournal:{records:[],receipts:[]}},revision:loaded.revision})).status,409);
  assert.equal((await request("/api/pet","POST",{...input,key:randomUUID()})).status,409);
  assert.equal((await request("/api/pet","POST",input,"https://untrusted.example")).status,403);
  stage="adopt and reset preserve human records";
  result=await json("/api/pet",{key:randomUUID(),revision:0,appRevision:loaded.revision,command:{action:"adopt",name:"합성 솜이"}});
  assert.equal(result.view.stats.learningTotalXP,0);assert.equal(result.app.activityJournal.records[0].id,input.key);
  result=await json("/api/pet",{key:randomUUID(),revision:result.revision,appRevision:result.appRevision,command:{action:"reset",confirm:"강아지 새로 시작"}});
  assert.equal(result.app.activityJournal.records[0].id,input.key);assert.equal(result.app.activityJournal.records.length,1);
  stage="sleep without a saved goal";
  const first=await json("/api/sleep",{kind:"wake"});assert.equal(first.record.actualAt,null);assert.equal(first.record.method,"web-no-target");
  const again=await json("/api/sleep",{kind:"wake"});assert.equal(again.record.checkedAt,first.record.checkedAt);
  const sleep=await (await request("/api/sleep")).json();assert.equal(sleep.profile.settings.goalEnabled,false);assert.equal(sleep.profile.settings.emailEnabled,false);
  const record=await pool.query("SELECT actual_at,method FROM sleep_records WHERE user_id=$1",[user.id]);assert.equal(record.rowCount,1);assert.equal(record.rows[0].actual_at,null);assert.equal(record.rows[0].method,"web-no-target");
  stage="independent human record correction";
  loaded=await (await request("/api/state")).json();const pet=await (await request("/api/pet")).json();
  result=await json("/api/pet",{key:randomUUID(),revision:pet.revision,appRevision:loaded.revision,command:{action:"cancel",id:input.key}});
  assert.equal(result.app.activityJournal.records[0].cancelled,true);assert.equal(result.app.planner.records.length,0);
  stage="sleep correction synchronizes independent facts";
  const bedId=randomUUID(),wakeId=randomUUID(),bedAt=new Date(`${yesterday}T00:00:00+09:00`).toISOString(),wakeAt=new Date(`${yesterday}T06:00:00+09:00`).toISOString(),checked=new Date().toISOString();
  for(const [id,kind,actual] of [[bedId,"bed",bedAt],[wakeId,"wake",wakeAt]])await pool.query("INSERT INTO sleep_records (id,user_id,session_date,kind,planned_at,checked_at,actual_at,method,updated_at) VALUES($1,$2,$3,$4,$5,$6,$5,'web-no-target',$6)",[id,user.id,yesterday,kind,actual,checked]);
  const sleepInput={key:randomUUID(),revision:result.revision,appRevision:result.appRevision,command:{action:"record",record:{title:"확인한 수면",type:"sleep",start:bedAt,end:wakeAt,intensity:"light",status:"done",source:{kind:"sleep",id:yesterday,date:yesterday}}}};
  result=await json("/api/pet",sleepInput);
  const corrected=new Date(Date.parse(wakeAt)+30*60000).toISOString();
  const patch=await request("/api/sleep","PATCH",{id:wakeId,actualAt:corrected});assert.equal(patch.status,200,(await patch.json()).error);
  loaded=await (await request("/api/state")).json();assert.equal(loaded.state.activityJournal.records.find(r=>r.id===sleepInput.key).end,corrected);
  assert.equal((await request("/api/sleep","PATCH",{id:wakeId,actualAt:null})).status,200);
  loaded=await (await request("/api/state")).json();assert.equal(loaded.state.activityJournal.records.find(r=>r.id===sleepInput.key).cancelled,true);
  console.log("PASS: Clerk -> API -> Neon -> restoration; no-adoption human execution; idempotence/CAS/CSRF; reset preserves facts; goal-free web sleep; cancellation; sleep correction and clearing synchronize human facts.");
}catch(error){console.error(`FAIL UX integration at ${stage}`);console.error(error.message?.replace(/https?:\/\/\S+/g,"[url]"));process.exitCode=1;}
finally{
  if(user){await pool.query("DELETE FROM user_states WHERE user_id=$1",[user.id]);await clerk.users.deleteUser(user.id);console.log("Disposable development identity and its rows cleaned up.");}
  await pool.end();
}
