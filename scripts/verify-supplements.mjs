// Disposable development identity only; never writes real account data.
import assert from "node:assert/strict";
import {randomUUID,randomBytes} from "node:crypto";
import {readFile} from "node:fs/promises";
import {parseEnv} from "node:util";
import {build} from "esbuild";
import {createClerkClient} from "@clerk/backend";
import pg from "pg";
const prod=parseEnv(await readFile(".env.production.local","utf8"));
assert.ok(process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"));assert.ok(process.env.DATABASE_URL&&process.env.DATABASE_URL!==prod.DATABASE_URL);
await build({entryPoints:["lib/model.ts"],bundle:true,platform:"node",format:"esm",outfile:"outputs/supplement-model.mjs"});
const {defaultAnswers,defaultSchedule,localDate}=await import("../outputs/supplement-model.mjs");
const clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY}),connection=new URL(process.env.DATABASE_URL);connection.searchParams.set("sslmode","verify-full");
const pool=new pg.Pool({connectionString:connection.toString(),max:1}),origin="http://localhost:3000";let user,session,stage="anonymous";
const request=async(path,method="GET",body,site=origin)=>fetch(origin+path,{method,headers:{origin:site,"Content-Type":"application/json",...(session?{Authorization:`Bearer ${(await clerk.sessions.getToken(session.id)).jwt}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
try{
  assert.equal((await request("/api/supplements")).status,401);stage="synthetic identity";
  user=await clerk.users.createUser({emailAddress:[`rf-dose-${randomUUID()}+clerk_test@example.com`],password:`${randomBytes(30).toString("base64url")}!aA1`,firstName:"Synthetic",lastName:"Supplement"});session=await clerk.sessions.createSession({userId:user.id});
  const date=localDate(),state={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-growth-v1",answers:{...defaultAnswers,name:"합성 복용 검증"},schedule:defaultSchedule,days:[],inbody:[],planner:{setupComplete:true,blocks:[],templates:[]}};
  stage="profile";assert.equal((await request("/api/state","PUT",{state,revision:0})).status,200);
  const before=await (await request("/api/state")).json();
  stage="product";const product={id:randomUUID(),name:"합성 테스트 제품",dose:"라벨 기준",startDate:date,weekdays:[0,1,2,3,4,5,6],slots:[{id:"am",anchor:"fixed",time:"09:00",offset:0}]};
  const save=await request("/api/supplements","POST",{revision:0,command:{action:"save",product}});assert.equal(save.status,200);let result=await save.json();assert.equal(result.revision,1);assert.equal(result.journal.records.length,0);
  stage="record";const command={action:"record",productId:product.id,date,slotId:"am",status:"taken"};assert.equal((await request("/api/supplements","POST",{revision:1,command})).status,200);
  assert.equal((await request("/api/supplements","POST",{revision:1,command})).status,409);
  assert.equal((await request("/api/supplements","POST",{revision:2,command})).status,200);
  stage="Neon restore";result=await (await request("/api/supplements")).json();assert.equal(result.journal.records.length,1);assert.equal(result.revision,3);
  const row=await pool.query("SELECT payload,revision FROM supplement_journals WHERE user_id=$1",[user.id]);assert.equal(row.rows[0].revision,3);assert.deepEqual(JSON.parse(row.rows[0].payload),result.journal);
  stage="isolation and validation";assert.equal((await request("/api/supplements","POST",{revision:3,command},"https://untrusted.example")).status,403);
  assert.equal((await request("/api/supplements","POST",{revision:3,command:{...command,date:"2099-01-01"}})).status,400);
  const after=await (await request("/api/state")).json();assert.deepEqual(after,before);
  stage="clear";assert.equal((await request("/api/supplements","POST",{revision:3,command:{action:"clear",recordId:result.journal.records[0].id}})).status,200);
  assert.equal((await (await request("/api/supplements")).json()).journal.records.length,0);
  session=null;assert.equal((await request("/api/supplements")).status,401);
  console.log("PASS: Clerk -> supplement API -> Neon -> restored record; duplicate/stale/CSRF/future guards; unchanged app state and revision; record undo.");
}catch(error){console.error(`FAIL supplement integration at ${stage}`);console.error(JSON.stringify({name:error.name,status:error.status,code:error.code,errors:error.errors?.map(e=>e.code)}));process.exitCode=1;}
finally{if(user){try{await pool.query("DELETE FROM user_states WHERE user_id=$1",[user.id]);assert.equal((await pool.query("SELECT user_id FROM supplement_journals WHERE user_id=$1",[user.id])).rowCount,0);await clerk.users.deleteUser(user.id);console.log("Synthetic development rows and identity cleaned up; cascade verified.");}catch{console.error("Synthetic cleanup needs inspection.");process.exitCode=1;}}await pool.end();}
