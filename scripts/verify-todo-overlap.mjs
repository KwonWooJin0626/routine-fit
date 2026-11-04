// Only disposable development identities and a database distinct from production.
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
await build({entryPoints:["lib/model.ts","lib/planner-model.ts"],bundle:true,platform:"node",format:"esm",outdir:"outputs/todo-api"});
const {defaultAnswers,defaultSchedule,initialCheckin,localDate}=await import("../outputs/todo-api/model.js");
const {plannerTodoSchema}=await import("../outputs/todo-api/planner-model.js");
const clerk=createClerkClient({secretKey:process.env.CLERK_SECRET_KEY}),url=new URL(process.env.DATABASE_URL);url.searchParams.set("sslmode","verify-full");const pool=new pg.Pool({connectionString:url.toString(),max:1});
const origin="http://localhost:3000";let user,session,stage="anonymous",cleanupFailed=false;
const request=async(path,method="GET",body,site=origin)=>fetch(origin+path,{method,headers:{Origin:site,"Content-Type":"application/json",...(session?{Authorization:`Bearer ${(await clerk.sessions.getToken(session.id)).jwt}`}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(45000)});
try{
  assert.equal((await request("/api/state")).status,401);
  stage="synthetic identity";
  user=await clerk.users.createUser({emailAddress:[`rf-todo-${randomUUID()}+clerk_test@example.com`],password:`${randomBytes(30).toString("base64url")}!aA1`,firstName:"Synthetic",lastName:"Todo"});session=await clerk.sessions.createSession({userId:user.id});
  const date=localDate(),todo=plannerTodoSchema.parse({id:randomUUID(),title:"합성 할 일",todayDate:date});
  const fields={category:"task",mental:3,physical:1,shade:1,location:"",task:"",kind:"once",date,weekdays:[],excludedDates:[]};
  const a={...fields,id:randomUUID(),title:todo.title,todoId:todo.id,start:"09:00",end:"11:00"},b={...fields,id:randomUUID(),title:"겹친 합성 일정",start:"10:00",end:"12:00"};
  const state={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-growth-v1",answers:{...defaultAnswers,name:"할 일 합성 검증"},schedule:{...defaultSchedule,events:[]},days:[],inbody:[],planner:{setupComplete:true,blocks:[a,b],templates:[],todos:[todo]}};
  stage="save overlapping plan and todo";assert.equal((await request("/api/state","PUT",{state,revision:0})).status,200);
  stage="Neon and restored state";const row=await pool.query("SELECT payload FROM user_states WHERE user_id=$1",[user.id]);const stored=JSON.parse(row.rows[0].payload);assert.equal(stored.planner.blocks.length,2);assert.equal(stored.planner.blocks[0].todoId,todo.id);
  let restored=await (await request("/api/state")).json();assert.equal(restored.state.planner.todos[0].title,todo.title);
  stage="full timeline with overlap warning";
  const planned=await request("/api/plan","POST",{answers:state.answers,checkin:initialCheckin(state.answers),mode:"full",schedule:state.schedule,history:[],refresh:false,planner:state.planner});assert.equal(planned.status,200);const plan=await planned.json();
  assert.ok(plan.day.timeline.some(t=>t.id.startsWith(`plan-${a.id}`)));assert.ok(plan.day.timeline.some(t=>t.id.startsWith(`plan-${b.id}`)));assert.ok(plan.day.warnings.some(w=>w.includes("겹쳐")));
  stage="task-only completion";restored=await (await request("/api/state")).json();restored.state.planner.todos[0].status="done";restored.state.planner.todos[0].completedAt=new Date().toISOString();
  assert.equal((await request("/api/state","PUT",{state:restored.state,revision:restored.revision})).status,200);
  const done=await (await request("/api/state")).json();assert.equal(done.state.planner.todos[0].status,"done");assert.equal(done.state.planner.records?.length??0,0);assert.equal(done.state.days.length,0);
  stage="validation and stale writes";assert.equal((await request("/api/state","PUT",{state,revision:0})).status,409);
  const invalid=structuredClone(done.state);invalid.planner.blocks[0].todoId="missing";assert.equal((await request("/api/state","PUT",{state:invalid,revision:done.revision})).status,400);
  assert.equal((await request("/api/state","PUT",{state,revision:done.revision},"https://untrusted.example")).status,403);
  console.log("PASS: Clerk -> state API -> Neon -> restored To-do and overlapping schedules, full timeline warnings, task-only completion without execution/XP, invalid links, stale/CSRF rejection.");
}catch(error){console.error(`FAIL To-do integration at ${stage}`);console.error(JSON.stringify({name:error.name,status:error.status,code:error.code,cause:error.cause?.code,errors:error.errors?.map(e=>e.code)}));process.exitCode=1;}
finally{if(user){try{await pool.query("DELETE FROM user_states WHERE user_id=$1",[user.id]);await clerk.users.deleteUser(user.id);}catch{cleanupFailed=true;}}await pool.end();console.log(cleanupFailed?"Synthetic cleanup needs inspection.":"Synthetic Clerk user and development DB rows cleaned up.");if(cleanupFailed)process.exitCode=1;}
