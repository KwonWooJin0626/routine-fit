// Development-only authenticated HTTP test. Never creates production Clerk users.
import assert from "node:assert/strict";
import { randomUUID,randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { createClerkClient } from "@clerk/backend";
import { build } from "esbuild";
import pg from "pg";
const production=parseEnv(await readFile(".env.production.local","utf8"));
assert.ok(process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"),"Development Clerk required");
assert.ok(process.env.DATABASE_URL&&process.env.DATABASE_URL!==production.DATABASE_URL,"Separate development DB required");
await build({entryPoints:["lib/model.ts"],bundle:true,platform:"node",format:"esm",outfile:"outputs/pet-api-model.mjs"});
const {defaultAnswers,defaultSchedule}=await import("../outputs/pet-api-model.mjs");
const origin="http://localhost:3000",clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY}),url=new URL(process.env.DATABASE_URL);url.searchParams.set("sslmode","verify-full");const pool=new pg.Pool({connectionString:url.toString(),max:1});
let user,stage="anonymous",cleanupFailed=false,authSession,activeToken,lastTokenAt=0;
async function call(path,token,method="GET",body,site=origin){if(token&&authSession){if(Date.now()-lastTokenAt>30000){activeToken=(await clerk.sessions.getToken(authSession)).jwt;lastTokenAt=Date.now();}token=activeToken;}return fetch(origin+path,{method,headers:{Origin:site,"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});}
try{
 assert.equal((await call("/api/pet")).status,401);
 stage="synthetic login";user=await clerk.users.createUser({emailAddress:[`routinefit-pet-${randomUUID()}+clerk_test@example.com`],password:`${randomBytes(30).toString("base64url")}!aA1`,firstName:"Synthetic",lastName:"Pet"});
 const session=await clerk.sessions.createSession({userId:user.id}),token=(await clerk.sessions.getToken(session.id)).jwt;authSession=session.id;activeToken=token;lastTokenAt=Date.now();
 stage="basic profile";const state={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-growth-v1",answers:{...defaultAnswers,name:"합성 검증"},schedule:defaultSchedule,days:[],inbody:[]};assert.equal((await call("/api/state",token,"PUT",{state,revision:0})).status,200);
 stage="adoption";const input={key:randomUUID(),revision:0,appRevision:1,command:{action:"adopt",name:"합성 솜이"}},response=await call("/api/pet",token,"POST",input);assert.equal(response.status,200);const pet=await response.json();assert.equal(pet.document.name,"합성 솜이");
 stage="idempotent retry";const retry=await (await call("/api/pet",token,"POST",input)).json();assert.equal(retry.duplicate,true);assert.equal(retry.revision,pet.revision);
 stage="meal persistence";const now=new Date().toISOString(),meal={key:randomUUID(),revision:pet.revision,appRevision:pet.appRevision,command:{action:"record",record:{title:"합성 식사",type:"meal",start:now,end:now,fullness:30,intensity:"moderate",source:{kind:"manual",id:randomUUID(),date:new Date(Date.now()+9*3600000).toISOString().slice(0,10)},status:"done"}}};
 const recorded=await call("/api/pet",token,"POST",meal);assert.equal(recorded.status,200);const result=await recorded.json();assert.equal(result.view.baseState,"tired");assert.ok(result.reactionId);assert.equal(result.document.records.length,1);
 stage="Neon row";const row=await pool.query("SELECT payload,revision FROM pet_companions WHERE user_id=$1",[user.id]);assert.equal(JSON.parse(row.rows[0].payload).records[0].fullness,30);assert.equal(row.rows[0].revision,result.revision);
 stage="restore";const restored=await (await call("/api/pet",token)).json();assert.equal(restored.document.records[0].id,result.document.records[0].id);assert.equal(restored.reactionId,undefined);
 stage="planner setup";
 const beginning=new Date(Math.floor((Date.now()-90*60000)/60000)*60000),ending=new Date(beginning.getTime()+30*60000);
 const korea=d=>new Date(d.getTime()+9*3600000).toISOString(),date=korea(beginning).slice(0,10);
 const block={id:randomUUID(),title:"합성 업무 일정",category:"work",petActivity:"work",location:"",task:"",start:korea(beginning).slice(11,16),end:korea(ending).slice(11,16),mental:3,physical:2,shade:1,kind:"once",date,weekdays:[],excludedDates:[]};
 const loaded=await (await call("/api/state",token)).json(),planned={...loaded.state,planner:{setupComplete:true,blocks:[block],templates:[]}};
 assert.equal((await call("/api/state",token,"PUT",{state:planned,revision:loaded.revision})).status,200);
 // The disposable fixture was just adopted. Move only its seed back to exercise past completed schedules.
 const fixture=structuredClone(restored.document),seedAt=new Date(beginning.getTime()-3600000).toISOString();fixture.adoptedAt=seedAt;fixture.seed.at=seedAt;fixture.seed.lastEvidenceAt=seedAt;
 await pool.query("UPDATE pet_companions SET payload=$1 WHERE user_id=$2",[JSON.stringify(fixture),user.id]);
 const ready=await (await call("/api/pet",token)).json(),command={action:"record",record:{title:block.title,type:"work",start:beginning.toISOString(),end:ending.toISOString(),breaks:[{start:new Date(beginning.getTime()+10*60000).toISOString(),end:new Date(beginning.getTime()+20*60000).toISOString()}],intensity:"moderate",source:{kind:"planner",id:block.id,date},status:"done"}};
 const submit={key:randomUUID(),revision:ready.revision,appRevision:ready.appRevision,command};
 stage="planner completion + pause persistence";
 const completedResponse=await call("/api/pet",token,"POST",submit);assert.equal(completedResponse.status,200);const completed=await completedResponse.json();
 assert.ok(completed.reactionId,"Work deserves a happy response");assert.equal(completed.app.planner.records[0].status,"done");assert.equal(completed.document.records.find(r=>r.id===submit.key).breaks.length,1);
 assert.equal((await (await call("/api/pet",token,"POST",submit)).json()).duplicate,true);
 const stored=await (await call("/api/pet",token)).json();assert.equal(stored.document.records.find(r=>r.id===submit.key).breaks.length,1);
 stage="planner skip + undo growth";
 const skippedResponse=await call("/api/pet",token,"POST",{key:randomUUID(),revision:completed.revision,appRevision:completed.appRevision,command:{action:"cancel",id:submit.key,replacementStatus:"skipped"}});assert.equal(skippedResponse.status,200);const skipped=await skippedResponse.json();
 assert.equal(skipped.app.planner.records[0].status,"skipped");assert.equal(skipped.document.records.find(r=>r.id===submit.key).cancelled,true);assert.equal(skipped.reactionId,undefined);
 stage="planner complete again + clear";
 const redone=await (await call("/api/pet",token,"POST",{key:randomUUID(),revision:skipped.revision,appRevision:skipped.appRevision,command})).json();assert.ok(redone.reactionId);
 const cleared=await (await call("/api/pet",token,"POST",{key:randomUUID(),revision:redone.revision,appRevision:redone.appRevision,command:{action:"cancel",id:redone.reactionId}})).json();assert.equal(cleared.app.planner.records.length,0);
 const finalState=await (await call("/api/state",token)).json();assert.equal(finalState.state.planner.records.length,0);
 stage="CSRF and stale rejection";assert.equal((await call("/api/pet",token,"POST",meal,"https://untrusted.test")).status,403);assert.equal((await call("/api/pet",token,"POST",{...meal,key:randomUUID()})).status,409);
 stage="scoped reset";assert.equal((await call("/api/state",token,"DELETE")).status,200);assert.equal((await pool.query("SELECT 1 FROM pet_companions WHERE user_id=$1",[user.id])).rowCount,0);
 console.log("PASS: Clerk session -> pet API -> Neon -> restored response, meal/happy state, duplicate/CAS/CSRF, planner completion/pause/skip/retry/cancel, full reset cascade.");
}catch{console.error(`FAIL pet HTTP integration at ${stage}`);process.exitCode=1;}finally{if(user){try{await pool.query("DELETE FROM user_states WHERE user_id=$1",[user.id]);await clerk.users.deleteUser(user.id);}catch{cleanupFailed=true;}}await pool.end();console.log(cleanupFailed?"Synthetic cleanup needs inspection.":"Synthetic Clerk user and DB rows cleaned up.");if(cleanupFailed)process.exitCode=1;}
