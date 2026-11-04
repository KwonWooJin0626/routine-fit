import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { plannerBlockSchema,plannerTodoSchema,plannerSchema,emptyPlanner,type PlannerBlock } from "../lib/planner-model";
import { upsertTodo,toggleTodo,removeTodo,todosForDate } from "../lib/planner-todos";
import { calendarSegments } from "../lib/planner-overlap";
import { validatePlanner,validatePlannerErrors,addDate,scheduleContext,scheduleForDate } from "../lib/planner";
import { changePlannerBlock,placeBlockRanges } from "../lib/planner-placement";
import { buildTimeline,buildRoutines,scheduleOverlapWarnings } from "../lib/engine";
import { defaultAnswers,defaultSchedule,initialCheckin,type AppState,stateSchema } from "../lib/model";
import { growthAnalysis } from "../lib/growth-analysis";
import { PlannerTodos } from "../components/planner-todos";
import { PlannerCalendarBlocks } from "../components/planner-calendar-blocks";
import { calendarRows } from "../lib/planner-grid";
import { createStateHandlers } from "../lib/state-api";

const date="2026-11-04",now=new Date(`${date}T12:00:00+09:00`);
const todo=()=>plannerTodoSchema.parse({id:"task",title:"발표자료 만들기",todayDate:date});
const block=(patch:Partial<PlannerBlock>={})=>plannerBlockSchema.parse({id:"first",title:"수업",category:"study",start:"09:00",end:"11:00",mental:3,physical:1,shade:1,location:"",task:"",kind:"once",date,weekdays:[],...patch});
const app=(planner=emptyPlanner()):AppState=>({version:1,consentAt:now.toISOString(),consentVersion:"2026-10-growth-v1",answers:{...defaultAnswers,name:"할 일 검증"},schedule:defaultSchedule,days:[],inbody:[],planner});

test("제목만으로 할 일을 저장하고 기본 목록은 완료·제목·세부 설정만 표시한다",()=>{
  const p=upsertTodo(emptyPlanner(),todo());assert.equal(p.blocks.length,0);assert.equal(p.todos![0].dueDate,undefined);assert.equal(p.todos![0].estimate,undefined);
  const html=renderToStaticMarkup(<PlannerTodos planner={p} date={date} busy={false} onSave={async()=>{}}/>);
  assert.match(html,/발표자료 만들기 세부 설정/);assert.ok(!html.includes('type="date"'));assert.ok(!html.includes("예상 소요 시간"));assert.ok(!html.includes('role="dialog"'));
});
test("할 일 완료·취소는 시간을 만들거나 일정 전체를 완료하지 않는다",()=>{
  let p=upsertTodo(emptyPlanner(),todo());p.blocks=[block({todoId:"task"})];
  p=toggleTodo(p,"task",now);assert.equal(p.todos![0].status,"done");assert.equal(p.todos![0].completedAt,now.toISOString());assert.equal(p.records,undefined);
  p=toggleTodo(p,"task",now);assert.equal(p.todos![0].status,"open");assert.equal(p.todos![0].completedAt,undefined);
  assert.throws(()=>toggleTodo(p,"missing"));
});
test("하나의 할 일을 여러 일정에 배치하고 한 일정의 완료로 전체 할 일을 완료하지 않는다",()=>{
  const p=upsertTodo(emptyPlanner(),todo());let n=0;
  const placed=placeBlockRanges(p,block({todoId:"task"}),[{date,start:"14:00",end:"15:00"},{date:addDate(date,1),start:"10:00",end:"11:00"}],"group",true,()=>`new-${++n}`);
  placed.records=[{blockId:placed.blocks[0].id,date,status:"done",title:placed.blocks[0].title,start:"14:00",end:"15:00",recordedAt:now.toISOString()}];
  assert.equal(placed.todos![0].status,"open");assert.ok(placed.blocks.every(b=>b.todoId==="task"));assert.ok(!("todoId" in placed.templates[0]));
  assert.equal(todosForDate(placed,addDate(date,1)).length,1);
});
test("할 일 제목 변경은 연결된 기본 제목만 바꾸고 개별 작업명·배치 시간은 보존한다",()=>{
  const p=upsertTodo(emptyPlanner(),todo());p.blocks=[block({todoId:"task",title:todo().title}),block({id:"custom",todoId:"task",title:"자료 조사",start:"15:00",end:"16:00"})];
  const next=upsertTodo(p,{...todo(),title:"새 발표자료"});assert.equal(next.blocks[0].title,"새 발표자료");assert.equal(next.blocks[1].title,"자료 조사");assert.equal(next.blocks[0].start,"09:00");assert.equal(p.todos![0].title,todo().title);
});
test("할 일만 삭제하면 일정 연결만 풀고 연결 일정 삭제는 실제 기록을 남긴다",()=>{
  const p=upsertTodo(emptyPlanner(),todo());p.blocks=[block({todoId:"task"})];p.records=[{blockId:"first",date,title:"수업",start:"09:00",end:"11:00",status:"done",recordedAt:now.toISOString()}];
  const kept=removeTodo(p,"task");assert.equal(kept.blocks.length,1);assert.equal(kept.blocks[0].todoId,undefined);assert.equal(kept.todos!.length,0);
  const removed=removeTodo(p,"task",true);assert.equal(removed.blocks.length,0);assert.deepEqual(removed.records,p.records);
});
test("중첩 구간을 정확한 멤버별로 나누고 가로 분할 없이 모든 일정을 확인할 수 있다",()=>{
  const p={...emptyPlanner(),blocks:[block(),block({id:"second",title:"과제",start:"10:00",end:"12:00"}),block({id:"third",title:"발표",start:"10:30",end:"11:30"})]};
  const segments=calendarSegments(p,date);assert.deepEqual(segments.map(s=>[s.from,s.until,s.occurrences.length]),[[540,600,1],[600,630,2],[630,660,3],[660,690,2],[690,720,1]]);
  const html=renderToStaticMarkup(<PlannerCalendarBlocks planner={p} date={date} today={date} rows={calendarRows(p,date,false)} busy={false} selecting={false} onEdit={()=>{}} onMark={()=>{}} onCompleteTodo={()=>{}}/>);
  assert.match(html,/sp-overlap-cell/);assert.match(html,/겹친 일정 3개/);assert.match(html,/sp-overlap-corner/);assert.ok(!html.includes("width:50%"));assert.match(html,/과제/);assert.match(html,/발표/);
});
test("인접 일정과 허용 휴식에는 중복 경고를 만들지 않고 휴식 일부와 겹치면 정확히 표시한다",()=>{
  const p={...emptyPlanner(),blocks:[block({start:"09:00",end:"18:00",breakStart:"12:00",breakEnd:"13:00"}),block({id:"meal",start:"12:00",end:"13:00"})]};
  assert.equal(calendarSegments(p,date).filter(s=>s.occurrences.length>1).length,0);assert.deepEqual(validatePlanner(p),[]);
  p.blocks[1].end="13:30";const overlaps=calendarSegments(p,date).filter(s=>s.occurrences.length>1);assert.deepEqual(overlaps.map(s=>[s.from,s.until]),[[780,810]]);
});
test("자정을 넘는 일정은 다음날 겹치는 실제 구간에 메모를 표시한다",()=>{
  const p={...emptyPlanner(),blocks:[block({start:"23:00",end:"02:00"}),block({id:"next",date:addDate(date,1),start:"01:00",end:"03:00"})]};
  assert.deepEqual(calendarSegments(p,addDate(date,1)).filter(s=>s.occurrences.length>1).map(s=>[s.from,s.until]),[[60,120]]);assert.deepEqual(validatePlannerErrors(p),[]);assert.ok(validatePlanner(p).length);
});
test("일정 중복을 허용해도 잘못된 시간·누락된 연결·중복 ID·일일 수 제한은 검증한다",()=>{
  assert.ok(!plannerBlockSchema.safeParse({...block(),end:"09:00"}).success);
  assert.ok(!plannerSchema.safeParse({...emptyPlanner(),blocks:[block({todoId:"missing"})]}).success);
  assert.ok(!plannerSchema.safeParse({...emptyPlanner(),todos:[todo(),todo()]}).success);
  const p={...emptyPlanner(),blocks:Array.from({length:31},(_,i)=>block({id:`limit-${i}`}))};assert.ok(validatePlannerErrors(p).length);
});
test("반복 제외일 이후에도 중복 경고를 발견하고 전체 수정·하루 수정은 중복을 허용한다",()=>{
  const excludedDates=[date,addDate(date,7)],p={...emptyPlanner(),blocks:[block({kind:"fixed",weekdays:[3],excludedDates}),block({id:"other",kind:"fixed",weekdays:[3],excludedDates})]};
  assert.ok(validatePlanner(p).some(w=>w.includes(addDate(date,14))));
  const changed=changePlannerBlock(p,{...p.blocks[0],start:"10:00",end:"12:00"},{old:p.blocks[0],date:addDate(date,14),scope:"date",groupId:"g",keep:false},()=>"replacement");
  assert.equal(changed.blocks.length,3);assert.ok(validatePlanner(changed).length);assert.ok(changed.blocks[0].excludedDates.includes(addDate(date,14)));
});
test("중첩된 일정 시간·분야 시간·예상 부담은 같은 시간을 반복 합산하지 않는다",()=>{
  const p={...emptyPlanner(),blocks:[block({start:"09:00",end:"11:00",mental:2}),block({id:"overlap",start:"10:00",end:"12:00",mental:4})]};
  const a=app(p),context=scheduleContext(defaultSchedule,p,date,initialCheckin(a.answers));assert.equal(context.scheduledMinutes,180);assert.equal(context.mental,3.3);
  const analysis=growthAnalysis(a,date);assert.equal(analysis.plannedMinutes,180);assert.equal(analysis.categories.find(c=>c.key==="study")!.minutes,180);
});
test("중복 계획을 유지하면서 새 루틴은 겹친 구간 밖에 배치한다",()=>{
  const p={...emptyPlanner(),blocks:[block({start:"09:00",end:"11:00"}),block({id:"overlap",start:"10:00",end:"12:00"})]},a=app(p),c=initialCheckin(a.answers);
  const schedule=scheduleForDate(defaultSchedule,p,date),plan=buildTimeline(buildRoutines(a.answers,c),schedule);
  assert.ok(plan.timeline.some(t=>t.id.startsWith("plan-first")));assert.ok(plan.timeline.some(t=>t.id.startsWith("plan-overlap")));assert.ok(plan.warnings.some(w=>w.includes("겹쳐")));
  for(const t of plan.timeline.filter(t=>t.routineId)){const minutes=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3));assert.ok(minutes(t.end)<=540||minutes(t.start)>=720);}
});
test("새 일정 미리보기에는 해당 일정의 중복만 안내하고 큰 일정 안의 모든 겹침도 찾는다",()=>{
  const p={...emptyPlanner(),blocks:[block(),block({id:"second",start:"10:00",end:"12:00"}),block({id:"new",start:"16:00",end:"17:00"})]};
  assert.ok(validatePlanner(p).length);assert.deepEqual(validatePlanner(p,new Set(["new"])),[]);
  const s={...defaultSchedule,events:[{id:"a",title:"긴 일정",start:"09:00",end:"14:00"},{id:"b",title:"앞 일정",start:"10:00",end:"11:00"},{id:"c",title:"뒤 일정",start:"12:00",end:"13:00"}]};
  assert.ok(scheduleOverlapWarnings(s).some(w=>w.includes("긴 일정")&&w.includes("뒤 일정")));
});
test("계정 API는 중첩 계획·할 일·연결·완료를 왕복 보존하고 잘못된 연결은 거절한다",async()=>{
  let row:{payload:string;revision:number}|null=null;
  const handlers=createStateHandlers(async()=>"todo-test",{get:async()=>row,save:async(_id,payload)=>{row={payload,revision:(row?.revision??0)+1};return row.revision;},remove:async()=>{row=null;}});
  let p=upsertTodo(emptyPlanner(),todo());p.blocks=[block({todoId:"task"}),block({id:"second",start:"10:00",end:"12:00"})];p=toggleTodo(p,"task",now);
  const s=app(p),put=(state:AppState)=>handlers.PUT(new Request("https://test.example/api/state",{method:"PUT",headers:{origin:"https://test.example"},body:JSON.stringify({state,revision:0})}));
  assert.equal((await put(s)).status,200);const restored=(await (await handlers.GET()).json()).state as AppState;
  assert.equal(restored.planner!.todos![0].status,"done");assert.equal(restored.planner!.blocks[0].todoId,"task");assert.ok(validatePlanner(restored.planner!).length);
  restored.planner!.blocks[0].todoId="missing";assert.equal((await put(restored)).status,400);
  assert.ok(stateSchema.safeParse(app()).success);
});
