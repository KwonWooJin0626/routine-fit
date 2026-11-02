// Disposable development identity only; never writes an existing user's data.
import assert from "node:assert/strict";
import { randomUUID,randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { build } from "esbuild";
import { createClerkClient } from "@clerk/backend";
import pg from "pg";

const production=parseEnv(await readFile(".env.production.local","utf8"));
assert.ok(process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"),"Development Clerk required");
assert.ok(process.env.DATABASE_URL&&process.env.DATABASE_URL!==production.DATABASE_URL,"Separate development database required");
await build({entryPoints:["lib/model.ts","lib/nutrition-profile.ts","lib/schedule-nutrition.ts"],bundle:true,platform:"node",format:"esm",outdir:"outputs/nutrition-api"});
const {defaultAnswers,defaultSchedule,localDate}=await import("../outputs/nutrition-api/model.js");
const {emptyNutritionProfile}=await import("../outputs/nutrition-api/nutrition-profile.js");
const {scheduleNutrition,saveScheduleAnswer}=await import("../outputs/nutrition-api/schedule-nutrition.js");
const clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY}),url=new URL(process.env.DATABASE_URL);
url.searchParams.set("sslmode","verify-full");const pool=new pg.Pool({connectionString:url.toString(),max:1});
const origin="http://localhost:3000";let user,stage="anonymous",cleanupFailed=false;
const request=(token,method="GET",body)=>fetch(`${origin}/api/state`,{method,headers:{Origin:origin,"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
try{
  assert.equal((await request()).status,401);
  stage="development identity";
  user=await clerk.users.createUser({emailAddress:[`rf-nutrition-${randomUUID()}+clerk_test@example.com`],password:`${randomBytes(30).toString("base64url")}!aA1`,firstName:"Synthetic",lastName:"Nutrition"});
  const session=await clerk.sessions.createSession({userId:user.id});
  const token=async()=>(await clerk.sessions.getToken(session.id)).jwt;
  const date=localDate(),block={id:randomUUID(),groupId:randomUUID(),title:"헬스",category:"exercise",start:"18:00",end:"19:00",mental:3,physical:3,shade:1,location:"",task:"",kind:"once",date,weekdays:[],excludedDates:[]};
  const state={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-growth-v1",answers:{...defaultAnswers,name:"합성 영양 검증"},schedule:{...defaultSchedule,events:[]},days:[],inbody:[],planner:{setupComplete:true,blocks:[block],templates:[]}};
  stage="old profile compatibility";
  assert.equal((await request(await token(),"PUT",{state,revision:0})).status,200);
  state.nutrition={...emptyNutritionProfile(),exerciseModes:[{blockId:block.groupId,title:block.title,mode:"strength"}]};
  const g=scheduleNutrition(state,date).guides.find(g=>g.id==="protein");assert.ok(g);
  state.nutrition=saveScheduleAnswer(state.nutrition,date,"protein",g.context,"difficult");
  stage="optional answer write";
  assert.equal((await request(await token(),"PUT",{state,revision:1})).status,200);
  stage="Neon persistence";
  const result=await pool.query("SELECT payload,revision FROM user_states WHERE user_id=$1",[user.id]);
  assert.equal(result.rows[0].revision,2);const stored=JSON.parse(result.rows[0].payload);
  assert.equal(stored.nutrition.scheduleChecks[0].answer,"difficult");assert.equal(stored.nutrition.reviewed,false);
  stage="restored recommendation";
  const restored=await (await request(await token())).json();
  assert.equal(scheduleNutrition(restored.state,date).guides.find(g=>g.id==="protein").answer,"difficult");
  stage="changed plan invalidates answer";
  restored.state.planner.blocks[0].end="20:00";
  assert.equal((await request(await token(),"PUT",{state:restored.state,revision:restored.revision})).status,200);
  const changed=await (await request(await token())).json();
  assert.equal(scheduleNutrition(changed.state,date).guides.find(g=>g.id==="protein").answer,undefined);
  stage="stale write rejected";
  assert.equal((await request(await token(),"PUT",{state,revision:1})).status,409);
  console.log("PASS: Clerk -> state API -> Neon -> restored schedule guide, optional answer, unknown safety retained, changed-plan invalidation, stale-write rejection.");
}catch(error){console.error(`FAIL nutrition integration at ${stage}`);console.error(JSON.stringify({name:error.name,status:error.status,code:error.code,cause:error.cause?.code,errors:error.errors?.map(e=>e.code)}));process.exitCode=1;}
finally{
  if(user){try{await pool.query("DELETE FROM user_states WHERE user_id=$1",[user.id]);await clerk.users.deleteUser(user.id);}catch{cleanupFailed=true;}}
  await pool.end();console.log(cleanupFailed?"Synthetic cleanup needs inspection.":"Synthetic Clerk user and development DB rows cleaned up.");
  if(cleanupFailed)process.exitCode=1;
}
