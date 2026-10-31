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
let user,stage="anonymous",cleanupFailed=false;
async function call(path,token,method="GET",body,site=origin){return fetch(origin+path,{method,headers:{Origin:site,"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});}
try{
 assert.equal((await call("/api/pet")).status,401);
 stage="synthetic login";user=await clerk.users.createUser({emailAddress:[`routinefit-pet-${randomUUID()}+clerk_test@example.com`],password:`${randomBytes(30).toString("base64url")}!aA1`,firstName:"Synthetic",lastName:"Pet"});
 const session=await clerk.sessions.createSession({userId:user.id}),token=(await clerk.sessions.getToken(session.id)).jwt;
 stage="basic profile";const state={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-growth-v1",answers:{...defaultAnswers,name:"합성 검증"},schedule:defaultSchedule,days:[],inbody:[]};assert.equal((await call("/api/state",token,"PUT",{state,revision:0})).status,200);
 stage="adoption";const input={key:randomUUID(),revision:0,appRevision:1,command:{action:"adopt",name:"합성 솜이"}},response=await call("/api/pet",token,"POST",input);assert.equal(response.status,200);const pet=await response.json();assert.equal(pet.document.name,"합성 솜이");
 stage="idempotent retry";const retry=await (await call("/api/pet",token,"POST",input)).json();assert.equal(retry.duplicate,true);assert.equal(retry.revision,pet.revision);
 stage="meal persistence";const now=new Date().toISOString(),meal={key:randomUUID(),revision:pet.revision,appRevision:pet.appRevision,command:{action:"record",record:{title:"합성 식사",type:"meal",start:now,end:now,fullness:30,intensity:"moderate",source:{kind:"manual",id:randomUUID(),date:new Date(Date.now()+9*3600000).toISOString().slice(0,10)},status:"done"}}};
 const recorded=await call("/api/pet",token,"POST",meal);assert.equal(recorded.status,200);const result=await recorded.json();assert.equal(result.view.baseState,"tired");assert.ok(result.reactionId);assert.equal(result.document.records.length,1);
 stage="Neon row";const row=await pool.query("SELECT payload,revision FROM pet_companions WHERE user_id=$1",[user.id]);assert.equal(JSON.parse(row.rows[0].payload).records[0].fullness,30);assert.equal(row.rows[0].revision,result.revision);
 stage="restore";const restored=await (await call("/api/pet",token)).json();assert.equal(restored.document.records[0].id,result.document.records[0].id);assert.equal(restored.reactionId,undefined);
 stage="CSRF and stale rejection";assert.equal((await call("/api/pet",token,"POST",meal,"https://untrusted.test")).status,403);assert.equal((await call("/api/pet",token,"POST",{...meal,key:randomUUID()})).status,409);
 stage="scoped reset";assert.equal((await call("/api/state",token,"DELETE")).status,200);assert.equal((await pool.query("SELECT 1 FROM pet_companions WHERE user_id=$1",[user.id])).rowCount,0);
 console.log("PASS: Clerk session -> pet API -> Neon -> restored response, meal/happy state, duplicate/CAS/CSRF, full reset cascade.");
}catch{console.error(`FAIL pet HTTP integration at ${stage}`);process.exitCode=1;}finally{if(user){try{await pool.query("DELETE FROM user_states WHERE user_id=$1",[user.id]);await clerk.users.deleteUser(user.id);}catch{cleanupFailed=true;}}await pool.end();console.log(cleanupFailed?"Synthetic cleanup needs inspection.":"Synthetic Clerk user and DB rows cleaned up.");if(cleanupFailed)process.exitCode=1;}
