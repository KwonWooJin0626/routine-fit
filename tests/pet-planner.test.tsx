import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultAnswers,defaultSchedule,initialCheckin,type AppState,stateSchema } from "../lib/model";
import { plannerBlockSchema,plannerSchema,type PlannerBlock } from "../lib/planner-model";
import { blockEffect,plannerExecutionTimes } from "../lib/pet-guidance";
import { executionMinutes } from "../lib/pet-execution";
import { applyPetCommand,projectPetRecords } from "../lib/pet-actions";
import { calculatePet,newPetDocument } from "../lib/pet-engine";
import { petCompletionMessage,petEffortSummary } from "../lib/pet-effort";
import { buildDay } from "../lib/engine";
import { applyBlockEdit } from "../lib/planner-edit";
import { placeBlockRanges } from "../lib/planner-placement";
import { ScheduleWorkspace } from "../components/schedule-workspace";
import { PlannerCompletionDialog } from "../components/planner-completion-dialog";
import { PetEffortPanel } from "../components/pet-effort-panel";
import type { PetCommand,PetDocument,PetExecution } from "../lib/pet-model";

const date="2026-11-01",now=new Date(`${date}T23:59:00+09:00`),seed=new Date("2026-10-01T00:00:00+09:00");
const block=(extra:Partial<PlannerBlock>={})=>plannerBlockSchema.parse({id:randomUUID(),title:"작은 실천",category:"study",start:"09:00",end:"09:30",mental:3,physical:2,shade:1,location:"",task:"",kind:"once",date,weekdays:[],...extra});
const state=(b:PlannerBlock):AppState=>({version:1,consentVersion:"2026-10-growth-v1",consentAt:seed.toISOString(),answers:{...defaultAnswers,name:"합성 검증"},schedule:defaultSchedule,days:[],inbody:[],planner:{setupComplete:true,blocks:[b],templates:[]}});
const pet=()=>newPetDocument("솜이",randomUUID(),seed);
const apply=(doc:PetDocument,app:AppState,command:PetCommand)=>applyPetCommand(doc,app,{key:randomUUID(),revision:1,appRevision:1,command},now);
function complete(doc:PetDocument,app:AppState,b:PlannerBlock){return apply(doc,app,{action:"record",record:{title:b.title,type:blockEffect(b),...plannerExecutionTimes(b,date),...(blockEffect(b)==="meal"?{start:plannerExecutionTimes(b,date).end,fullness:60 as const}:{}),intensity:"moderate",status:"done",source:{kind:"planner",id:b.id,date}}});}
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<.0001,`${a} != ${b}`);

test("모든 일정 카테고리와 생활 활동은 실제 확인 후 기쁨 반응과 수행 기록을 남긴다",()=>{
  for(const category of ["study","work","task","meal","growth","exercise","social","rest"] as const){
    const b=block({category}),result=complete(pet(),state(b),b);
    assert.ok(result.reactionId,category);assert.equal(result.app.planner?.records?.[0].status,"done");
    assert.equal(result.document.records.length,1);assert.ok(stateSchema.safeParse(result.app).success,JSON.stringify(stateSchema.safeParse(result.app)));
    const summary=petEffortSummary(result.document,date,now);assert.equal(summary.activities,1);
  }
  const b=block({petActivity:"none"}),result=complete(pet(),state(b),b),v=calculatePet(result.document,now);
  assert.ok(result.reactionId);assert.equal(v.stats.learningTotalXP,0);assert.equal(v.stats.fitnessTotalXP,0);
});

test("원본 블록의 활동 지정은 기존 데이터·다중 배치·전체 수정과 호환된다",()=>{
  const b=block({category:"growth",petActivity:"rest"}),p=state(b).planner!;
  assert.equal(blockEffect(b),"rest");assert.equal(blockEffect(block({category:"growth"})),"growth");
  const placed=placeBlockRanges(p,b,[{date,start:"11:00",end:"11:30"}],"group",true,randomUUID);
  assert.equal(placed.blocks.at(-1)?.petActivity,"rest");assert.equal(placed.templates[0].petActivity,"rest");
  const edited=applyBlockEdit(placed,{groupId:"group",blockIds:placed.blocks.map(x=>x.id),templateIds:placed.templates.map(x=>x.id),content:{title:"독서 공부",category:"growth",petActivity:"study",location:"",task:"",mental:1,physical:1,shade:1}});
  assert.ok(edited.blocks.every(x=>x.petActivity==="study"));assert.equal(edited.templates[0].petActivity,"study");
  assert.ok(plannerSchema.safeParse(edited).success);
});

test("일정과 연결된 루틴은 한 실제 수행만 만들고 취소·미진행도 원자적으로 반영한다",()=>{
  const b=block({category:"exercise",kind:"fixed",date:"2026-10-01",weekdays:[0]}),app=state(b);
  const day=buildDay(defaultAnswers,initialCheckin(defaultAnswers),"core",defaultSchedule,[],undefined,date);
  day.routines[0].activity={domain:"exercise",id:"run",goalMinutes:30,overheadMinutes:0,preferredTime:"any",linkedEvent:`plan-${b.id}-${date}`} as never;app.days=[day];
  const first=complete(pet(),app,b),id=first.document.records[0].id;
  assert.equal(first.document.records[0].sources.length,2);assert.equal(first.app.days[0].statuses[day.routines[0].id],"done");
  assert.equal(first.app.days[0].activityFeedback?.[day.routines[0].id]?.actualMinutes,30);
  near(calculatePet(first.document,now).stats.fitnessTotalXP,5);
  assert.throws(()=>complete(first.document,first.app,b),/이미 반영/);
  assert.equal(first.app.planner?.records?.some(r=>r.date==="2026-11-08"),false);
  const cancelled=apply(first.document,first.app,{action:"cancel",id,replacementStatus:"skipped"});
  assert.equal(cancelled.app.days[0].statuses[day.routines[0].id],"skipped");assert.equal(cancelled.app.planner?.records?.[0].status,"skipped");
  assert.equal(calculatePet(cancelled.document,now).stats.fitnessTotalXP,0);assert.equal(cancelled.reactionId,undefined);
  // Later settings must not resurrect a cancelled completion or override a user's new checkbox state.
  const changed=structuredClone(cancelled.app);changed.planner!.records=[];delete changed.days[0].statuses[day.routines[0].id];
  const later=apply(cancelled.document,changed,{action:"settings",name:"솜이",visible:true,reducedMotion:false});
  assert.equal(later.app.planner?.records?.length,0);assert.equal(later.app.days[0].statuses[day.routines[0].id],undefined);
  const restored=complete(cancelled.document,cancelled.app,b);assert.equal(restored.document.records.filter(r=>!r.cancelled).length,1);
  near(calculatePet(restored.document,now).stats.fitnessTotalXP,5);
  const undone=apply(restored.document,restored.app,{action:"cancel",id:restored.document.records.at(-1)!.id});
  assert.equal(undone.app.planner?.records?.length,0);assert.equal(undone.app.days[0].statuses[day.routines[0].id],undefined);
});

test("쉬는 시간을 뺀 긴 일정과 그 안의 별도 활동을 중복 시간 없이 계산한다",()=>{
  const b=block({start:"09:00",end:"18:00",breakStart:"12:00",breakEnd:"13:00"}),app=state(b);
  const result=complete(pet(),app,b);near(executionMinutes(result.document.records[0]),480);
  near(calculatePet(result.document,now).stats.learningTotalXP,160);
  const activity={title:"점심 산책",type:"exercise" as const,start:new Date(`${date}T12:10:00+09:00`).toISOString(),end:new Date(`${date}T12:40:00+09:00`).toISOString(),intensity:"moderate" as const,status:"done" as const,source:{kind:"manual" as const,id:randomUUID(),date}};
  const withBreakActivity=apply(result.document,result.app,{action:"record",record:activity});
  near(calculatePet(withBreakActivity.document,now).stats.fitnessTotalXP,5);
  assert.throws(()=>apply(result.document,result.app,{action:"record",record:{...activity,start:new Date(`${date}T11:50:00+09:00`).toISOString()}}),/겹쳐/);
  assert.throws(()=>apply(pet(),app,{action:"record",record:{...activity,breaks:[{start:activity.start,end:activity.end}]}}),/쉬는 시간/);
});

test("자정을 넘는 일정은 정확한 다음날 시각과 날짜별 수행 시간을 사용한다",()=>{
  const b=block({start:"23:00",end:"02:00",breakStart:"00:00",breakEnd:"01:00"}),times=plannerExecutionTimes(b,date);
  assert.equal(times.end,new Date("2026-11-02T02:00:00+09:00").toISOString());near(executionMinutes(times),120);
  assert.equal(times.breaks?.[0].start,new Date("2026-11-02T00:00:00+09:00").toISOString());
  assert.throws(()=>complete(pet(),state(b),b),/실제 시각/);
  const finished=new Date("2026-11-02T03:00:00+09:00"),r={id:"night",title:"밤 공부",type:"study",...times,status:"done",intensity:"moderate",sources:[],cancelled:false,feeling:"same",updatedAt:finished.toISOString()} as PetExecution;
  const doc=pet();doc.records=[r];
  assert.equal(petEffortSummary(doc,date,finished).focus,60);assert.equal(petEffortSummary(doc,"2026-11-02",finished).focus,60);
  assert.equal(petEffortSummary(doc,date,finished).activities,0);assert.equal(petEffortSummary(doc,"2026-11-02",finished).activities,1);
});

test("노력 요약은 일부 수행·취소·연결 출처를 구분하고 피드백은 모든 활동을 인정한다",()=>{
  const b=block({category:"work"}),result=complete(pet(),state(b),b),view=calculatePet(result.document,now);
  const summary=petEffortSummary(result.document,date,now);assert.equal(summary.work,30);assert.equal(summary.activities,1);assert.match(summary.message,/회복/);
  const input={action:"record",record:{...result.document.records[0],source:result.document.records[0].sources[0]}} as PetCommand;
  assert.match(petCompletionMessage(input,{...result,view,revision:1,appRevision:1}),/해야 할 일을 해냈어요/);
  assert.match(petCompletionMessage(input,{...result,view,revision:1,appRevision:1,duplicate:true}),/중복/);
  const partial=structuredClone(result.document);partial.records[0].status="partial";assert.equal(petEffortSummary(partial,date,now).partial,1);
  partial.records[0].cancelled=true;assert.equal(petEffortSummary(partial,date,now).activities,0);
  const fresh=newPetDocument("솜이","fresh",now);assert.match(petEffortSummary(fresh,date,now).comparison,/2주 기록/);
  assert.equal(projectPetRecords(result.app,result.document).planner?.records?.length,1);
});

test("주간 칸의 완료와 수정은 별도 버튼이며 빠른 실제 확인과 노력 요약을 표시한다",context=>{
  context.mock.timers.enable({apis:["Date"],now});const b=block(),app=state(b),doc=pet(),times=plannerExecutionTimes(b,date);
  const grid=renderToStaticMarkup(<ScheduleWorkspace state={app} busy={false} onSave={async()=>{}} onGenerate={()=>{}} onSettings={()=>{}} onRecord={async()=>{}}/>);
  assert.match(grid,/sp-event-complete/);assert.match(grid,/sp-event-open/);assert.match(grid,/일정 완료/);
  let depth=0;for(const tag of grid.match(/<\/?button\b[^>]*>/g)??[]){depth+=tag.startsWith("</")?-1:1;assert.ok(depth>=0&&depth<=1,"nested button");}assert.equal(depth,0);
  const quick=renderToStaticMarkup(<PlannerCompletionDialog draft={{source:{kind:"planner",id:b.id,date},title:b.title,type:"study",minutes:30,planned:times}} document={doc} busy={false} onSave={async()=>{}} onLater={async()=>{}} onDetailed={()=>{}} onClose={()=>{}}/>);
  assert.match(quick,/예정대로 했어요/);assert.match(quick,/일부 했어요/);assert.match(quick,/체크만 저장/);
  const result=complete(doc,app,b),panel=renderToStaticMarkup(<PetEffortPanel pet={{...result,view:calculatePet(result.document,now),revision:1,appRevision:1}}/>);
  assert.match(panel,/오늘의 노력/);assert.match(panel,/집중/);assert.match(panel,/최근 7일/);
});
