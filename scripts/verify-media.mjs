// Only synthetic accounts in the development Clerk/Neon environment.
import assert from "node:assert/strict";
import {randomUUID,randomBytes} from "node:crypto";
import {parseEnv} from "node:util";
import {readFile} from "node:fs/promises";
import {createClerkClient} from "@clerk/backend";
import {build} from "esbuild";
import pg from "pg";
const production=parseEnv(await readFile(".env.production.local","utf8"));
assert.ok(process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"));assert.ok(process.env.DATABASE_URL&&process.env.DATABASE_URL!==production.DATABASE_URL);
await build({entryPoints:["lib/model.ts","lib/media.ts"],bundle:true,platform:"node",format:"esm",outdir:"outputs/media-integration"});
const {defaultAnswers,defaultSchedule,localDate}=await import("../outputs/media-integration/model.js");
const {emptyMediaProfile,recordMediaReaction}=await import("../outputs/media-integration/media.js");
const origin="http://localhost:3000",clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY}),url=new URL(process.env.DATABASE_URL);url.searchParams.set("sslmode","verify-full");
const pool=new pg.Pool({connectionString:url.toString(),max:1}),users=[];let stage="initialization",cleanupFailed=false;
async function account(){const u=await clerk.users.createUser({emailAddress:[`routinefit-media-${randomUUID()}+clerk_test@example.com`],password:`${randomBytes(30).toString("base64url")}!aA1`,firstName:"Synthetic",lastName:"Media"});users.push(u.id);const s=await clerk.sessions.createSession({userId:u.id});return (await clerk.sessions.getToken(s.id)).jwt;}
async function call(path,token,method="GET",body,site=origin){return fetch(origin+path,{method,headers:{Origin:site,"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});}
async function ok(path,token,method="GET",body){const r=await call(path,token,method,body);assert.equal(r.status,200,`Unexpected status at ${stage}`);return r.json();}
try{
 stage="anonymous protection";assert.equal((await call("/api/media?kind=book&key=essay")).status,401);
 const token=await account(),other=await account(),date=localDate();
 const state={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-growth-v1",answers:{...defaultAnswers,name:"합성 콘텐츠 계정"},schedule:defaultSchedule,inbody:[],days:[],media:{...emptyMediaProfile(),interests:["relationships","happiness","health"],books:["poetry","logic"],music:["classical","jazz"],vocals:"instrumental",reading:[{id:"synthetic-book",title:"합성 검증 책",author:"합성 저자",category:"poetry",url:"https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=123",status:"reading",updatedAt:new Date().toISOString()}]}};
 stage="state bootstrap";let revision=(await ok("/api/state",token,"PUT",{state,revision:0})).revision;
 stage="catalog links and fixed category validation";for(const path of ["/api/media?kind=book&key=logic","/api/media?kind=music&key=jazz&context=reading"]){const r=await ok(path,token);assert.ok(["links","live","unavailable"].includes(r.mode));assert.ok(r.sourceUrl.startsWith("https://"));assert.equal("ttbkey" in r,false);}
 assert.equal((await call("/api/media?kind=book&key=unknown",token)).status,400);assert.equal((await call("/api/media?kind=music&key=jazz&context=unknown",token)).status,400);
 stage="preference roundtrip and account isolation";assert.deepEqual((await ok("/api/state",token)).state.media,state.media);assert.equal((await ok("/api/state",other)).state,null);
 const row=await pool.query("SELECT payload FROM user_states WHERE user_id=$1",[users[0]]);assert.equal(JSON.parse(row.rows[0].payload).media.reading[0].title,"합성 검증 책");
 stage="interest edit and restore";state.media.interests=["mind","learning"];revision=(await ok("/api/state",token,"PUT",{state,revision})).revision;assert.deepEqual((await ok("/api/state",token)).state.media.interests,["mind","learning"]);
 stage="interest separate from completion";state.media=recordMediaReaction(state.media,"music","jazz",date,"open");revision=(await ok("/api/state",token,"PUT",{state,revision})).revision;const after=await ok("/api/state",token);assert.equal(after.state.days.length,0);assert.equal(after.state.media.reactions.length,1);
 stage="status and persistence";state.media.reading[0].status="finished";revision=(await ok("/api/state",token,"PUT",{state,revision})).revision;assert.equal((await ok("/api/state",token)).state.media.reading[0].status,"finished");
 stage="CSRF, stale writes and unsafe links";assert.equal((await call("/api/state",token,"PUT",{state,revision},"https://untrusted.test")).status,403);assert.equal((await call("/api/state",token,"PUT",{state,revision:0})).status,409);
 const unsafe=structuredClone(state);unsafe.media.reading[0].url="javascript:alert(1)";assert.equal((await call("/api/state",token,"PUT",{state:unsafe,revision})).status,400);
 stage="reset removes content preferences";await ok("/api/state",token,"DELETE");assert.equal((await ok("/api/state",token)).state,null);
 console.log("PASS: Clerk -> media/state HTTP -> Neon, categories, preferences, reading status, interest separation, isolation, CSRF/CAS, unsafe URLs and reset.");
}catch{console.error(`FAIL media integration at ${stage}`);process.exitCode=1;}finally{for(const id of users){try{await pool.query("DELETE FROM user_states WHERE user_id=$1",[id]);await clerk.users.deleteUser(id);}catch{cleanupFailed=true;}}await pool.end();console.log(cleanupFailed?"Synthetic cleanup needs inspection.":"Synthetic users and records cleaned up.");if(cleanupFailed)process.exitCode=1;}
