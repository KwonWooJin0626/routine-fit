// Authenticated development-only verification; synthetic data is cleaned up.
import assert from "node:assert/strict";
import { randomUUID,randomBytes } from "node:crypto";
import { parseEnv } from "node:util";
import { readFile } from "node:fs/promises";
import { createClerkClient } from "@clerk/backend";
import { build } from "esbuild";
import pg from "pg";
const production=parseEnv(await readFile(".env.production.local","utf8"));
assert.ok(process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"));assert.ok(process.env.DATABASE_URL&&process.env.DATABASE_URL!==production.DATABASE_URL);
await build({entryPoints:["lib/model.ts","lib/recommendation-learning.ts"],bundle:true,platform:"node",format:"esm",outdir:"outputs/adaptive-integration"});
const {defaultAnswers,defaultSchedule,localDate}=await import("../outputs/adaptive-integration/model.js");
const {canonicalRoutineId}=await import("../outputs/adaptive-integration/recommendation-learning.js");
const origin="http://localhost:3000",clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY}),url=new URL(process.env.DATABASE_URL);url.searchParams.set("sslmode","verify-full");const pool=new pg.Pool({connectionString:url.toString(),max:1}),users=[];
let stage="initialization",cleanupFailed=false;
async function account(){const user=await clerk.users.createUser({emailAddress:[`routinefit-rec-${randomUUID()}+clerk_test@example.com`],password:`${randomBytes(30).toString("base64url")}!aA1`,firstName:"Synthetic",lastName:"Recommendation"});users.push(user.id);const session=await clerk.sessions.createSession({userId:user.id});return (await clerk.sessions.getToken(session.id)).jwt;}
async function call(path,token,method="GET",body,site=origin){return fetch(origin+path,{method,headers:{Origin:site,"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});}
async function ok(path,token,method="GET",body){const r=await call(path,token,method,body);assert.equal(r.status,200,`HTTP ${r.status} at ${stage}`);return r.json();}
try{
 stage="anonymous protection";assert.equal((await call("/api/recommendations")).status,401);
 const token=await account(),other=await account();
 const date=localDate(),answers={...defaultAnswers,name:"합성 추천 계정"},checkin={reported:true,sleep:7,energy:3,stress:3,minutes:30,unwell:false,place:"home",busy:false};
 const input={answers,checkin,mode:"core",schedule:defaultSchedule,history:[],refresh:true};
 stage="first plan before state";const initial=await ok("/api/plan",token,"POST",input);assert.equal(initial.day.routines.length,3);
 const state={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-growth-v1",answers,schedule:defaultSchedule,inbody:[],days:[initial.day]};
 stage="state bootstrap";let revision=(await ok("/api/state",token,"PUT",{state,revision:0})).revision;
 const first=state.days[0].routines[0],second=state.days[0].routines[1],id=canonicalRoutineId(first),secondId=canonicalRoutineId(second);
 stage="observed interest and duplicate";const event={action:"events",events:[{kind:"search",date,routineId:first.id},{kind:"recommendation_view",date,routineId:first.id}]};
 const seen=await ok("/api/recommendations",token,"POST",event),again=await ok("/api/recommendations",token,"POST",event);assert.equal(seen.memory.stats[id].interest,again.memory.stats[id].interest);assert.ok(seen.memory.stats[id].interest>.5);
 stage="completed state learns atomically";state.days[0].statuses[first.id]="done";revision=(await ok("/api/state",token,"PUT",{state,revision})).revision;assert.ok((await ok("/api/recommendations",token)).memory.stats[id].execution>.5);
 stage="remove and undo";state.days[0].routines=state.days[0].routines.filter(r=>r.id!==second.id);revision=(await ok("/api/state",token,"PUT",{state,revision,intent:{kind:"remove",date,routineId:second.id}})).revision;
 const removed=await ok("/api/recommendations",token);assert.ok(removed.memory.stats[secondId].deletion>.1);assert.ok(removed.memory.excludedToday.includes(secondId));
 state.days[0].routines.push(second);revision=(await ok("/api/state",token,"PUT",{state,revision,intent:{kind:"restore",date,routineId:second.id}})).revision;assert.equal((await ok("/api/recommendations",token)).memory.stats[secondId].deletion,.1);
 stage="preference persistence and five-routine regeneration";await ok("/api/recommendations",token,"POST",{action:"settings",count:5});const next=await ok("/api/plan",token,"POST",{...input,history:state.days});assert.equal(next.day.routines.length,5);assert.equal(next.day.statuses[first.id],"done");
 stage="server audit persisted";const row=await pool.query("SELECT payload FROM recommendation_profiles WHERE user_id=$1",[users[0]]),doc=JSON.parse(row.rows[0].payload),batch=doc.batches.find(b=>b.meta.batchId===next.day.recommendation.batchId);assert.ok(batch);assert.ok(batch.choices.every(x=>x.probability>0&&x.probability<=1&&x.pool.length>0));
 stage="ML snapshot, exposure linkage, outcome undo and training export";assert.ok(batch.learning?.choices.length);state.days=[next.day];revision=(await ok("/api/state",token,"PUT",{state,revision})).revision;
 const selected=next.day.routines.find(r=>!next.day.statuses[r.id]),position=next.day.routines.findIndex(r=>r.id===selected.id);
 await ok("/api/recommendations",token,"POST",{action:"events",events:[{kind:"recommendation_view",date,routineId:selected.id,batchId:batch.meta.batchId,position}]});
 state.days[0].statuses[selected.id]="done";revision=(await ok("/api/state",token,"PUT",{state,revision})).revision;
 let learningDoc=JSON.parse((await pool.query("SELECT payload FROM recommendation_profiles WHERE user_id=$1",[users[0]])).rows[0].payload);
 let observed=learningDoc.batches.find(b=>b.meta.batchId===batch.meta.batchId).learning.choices.find(c=>c.routineId===selected.id);assert.equal(observed.observation.status,"done");assert.ok(observed.features.every(Number.isFinite));
 const training=await ok("/api/recommendations/training?download=1",token);assert.equal(training.schema,"routine-completion-v1");assert.equal(training.summary.exposed,1);assert.equal(training.rows.length,0);assert.equal((await ok("/api/recommendations/training",other)).summary.batches,0);
 assert.equal((await call("/api/recommendations/training?userId=other",token)).status,400);assert.equal((await call("/api/recommendations/training")).status,401);
 delete state.days[0].statuses[selected.id];revision=(await ok("/api/state",token,"PUT",{state,revision})).revision;
 learningDoc=JSON.parse((await pool.query("SELECT payload FROM recommendation_profiles WHERE user_id=$1",[users[0]])).rows[0].payload);observed=learningDoc.batches.find(b=>b.meta.batchId===batch.meta.batchId).learning.choices.find(c=>c.routineId===selected.id);assert.equal(observed.observation.status,undefined);
 stage="isolation, CSRF, stale CAS";assert.deepEqual((await ok("/api/recommendations",other)).memory.stats,{});assert.equal((await call("/api/recommendations",token,"POST",event,"https://untrusted.test")).status,403);assert.equal((await call("/api/state",token,"PUT",{state,revision:1})).status,409);
 stage="cascade export and reset";assert.ok((await ok("/api/recommendations?export=1",token)).document.signals.length);await ok("/api/state",token,"DELETE");assert.equal((await pool.query("SELECT 1 FROM recommendation_profiles WHERE user_id=$1",[users[0]])).rowCount,0);
 console.log("PASS: Clerk -> recommendation API -> Neon, duplicate-safe interest, completion, removal/undo, 3/5 count, audit probabilities, ML feature snapshots/exposure/undo/export, isolation, CSRF, CAS, export/reset.");
}catch(error){console.error(`FAIL recommendation integration at ${stage}: ${error instanceof assert.AssertionError?error.message:'request'}`);process.exitCode=1;}finally{for(const id of users){try{await pool.query("DELETE FROM user_states WHERE user_id=$1",[id]);await clerk.users.deleteUser(id);}catch{cleanupFailed=true;}}await pool.end();console.log(cleanupFailed?"Synthetic cleanup needs inspection.":"Synthetic users and records cleaned up.");if(cleanupFailed)process.exitCode=1;}
