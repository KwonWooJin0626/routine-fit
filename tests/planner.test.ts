import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { PlannerRoutineAction } from "../components/planner-routine-action";
import { emptyPlanner,plannerBlockSchema,plannerSchema,type PlannerBlock } from "../lib/planner-model";
import { addDate,mondayOf,blocksForDate,occurrencesInWindow,validatePlanner,scheduleForDate,buildPlannedDay } from "../lib/planner";
import { type AppState,defaultAnswers,defaultSchedule,initialCheckin,stateSchema,daySchema } from "../lib/model";
import { buildRoutinePreview } from "../lib/routine-preview";
import { buildTimeline,validateSchedule } from "../lib/engine";
import { applyBlockRemoval,removalCandidates,removeSavedBlockPlans,restoreSavedBlockPlans,type RemovalRequest } from "../lib/planner-removal";
import { applyBlockEdit,editSavedBlockPlans,blockContentSchema,type BlockEditRequest } from "../lib/planner-edit";
import { calendarRows,calendarEventRect,SLOT_HEIGHT,GAP_HEIGHT } from "../lib/planner-grid";

const a={...defaultAnswers,name:"계획 테스트"},c=initialCheckin(a),date="2026-10-15";
const block=(overrides:Partial<PlannerBlock>={}):PlannerBlock=>({id:"class-1",title:"수업",category:"study",location:"강의실",task:"팀 프로젝트",start:"09:00",end:"11:00",mental:3,physical:2,shade:1,kind:"fixed",date:"2026-10-12",weekdays:[1,4],excludedDates:[],...overrides});

const editRequest=(overrides:Partial<BlockEditRequest>={}):BlockEditRequest=>({groupId:"family",blockIds:["class-1","override"],templateIds:["template"],content:{title:"프로젝트 실습",category:"work",location:"새 강의실",task:"발표 준비",mental:5,physical:4,shade:3},...overrides});
const previewState=():AppState=>({version:1,consentAt:"2026-10-15T00:00:00.000Z",consentVersion:"2026-10-v1",answers:a,schedule:defaultSchedule,inbody:[],days:[buildPlannedDay(a,c,"core",defaultSchedule,[],undefined,date)]});
test("미리보기는 선택 날짜의 반복·추가 일정과 부담을 반영하고 오늘 기록을 변경하지 않는다",()=>{
  const state=previewState();state.planner={...emptyPlanner(),blocks:[block(),block({id:"future",kind:"once",date:"2026-10-16",start:"09:00",end:"18:00",mental:5,physical:5,breakStart:"12:00",breakEnd:"13:00"})]};
  const id=state.days[0].routines[0].id;state.days[0].statuses[id]="partial";state.days[0].notes[id]="유지";const snapshot=structuredClone(state);
  const preview=buildRoutinePreview(state,"2026-10-16",c,"full",date);
  assert.equal(preview.date,"2026-10-16");assert.equal(preview.planningContext?.mental,5);assert.equal(preview.planningContext?.effectiveMinutes,10);assert.ok(preview.timeline.some(t=>t.id==="plan-future-2026-10-16"));
  assert.ok(!preview.timeline.some(t=>t.id.startsWith("plan-class-1-")));assert.deepEqual(preview.statuses,{});assert.deepEqual(preview.notes,{});assert.deepEqual(state,snapshot);assert.ok(daySchema.safeParse(preview).success);
  const nextWeek=buildRoutinePreview(state,"2026-10-22",c,"full",date);assert.ok(nextWeek.timeline.some(t=>t.id==="plan-class-1-2026-10-22"));assert.ok(!nextWeek.timeline.some(t=>t.id.startsWith("plan-future-")));
});
test("미리보기는 같은 날짜의 완료·커스텀 루틴과 미래 기록을 복제하지 않는다",()=>{
  const state=previewState(),original=state.days[0];
  const target={...structuredClone(original),date:"2026-10-16"};target.routines=[{...target.routines[0],id:"custom-preview-test",source:"custom"}];target.statuses={"custom-preview-test":"done"};target.notes={"custom-preview-test":"기록"};state.days.push(target);
  const result=buildRoutinePreview(state,target.date,c,"core",date);assert.ok(!result.routines.some(r=>r.id==="custom-preview-test"));assert.deepEqual(result.statuses,{});assert.deepEqual(result.notes,{});
  const baseline=buildRoutinePreview({...state,days:[original]},target.date,c,"core",date);assert.deepEqual(result,baseline);
});
test("예상 조건을 바꾸면 회복·시간 제한을 반영하고 과거 날짜도 읽기 전용으로 계산한다",()=>{
  const state=previewState(),snapshot=structuredClone(state);
  const expected={...c,sleep:4,energy:1,stress:5,minutes:5,unwell:true};
  const preview=buildRoutinePreview(state,"2026-10-14",expected,"core",date);assert.deepEqual(preview.checkin,expected);assert.ok(preview.routines.filter(r=>!r.held).reduce((n,r)=>n+r.minutes,0)<=5);assert.ok(preview.routines.filter(r=>r.category==="move").every(r=>["move-recovery","move-rest"].includes(r.id)));
  assert.deepEqual(state,snapshot);assert.throws(()=>buildRoutinePreview(state,"2026-02-30",c,"core",date));assert.throws(()=>buildRoutinePreview(state,"2026-10-16",{...c,minutes:241},"core",date));
});
test("날짜별 미리보기는 해당 날짜 이후의 InBody를 사용하지 않는다",()=>{
  const state=previewState();state.inbody=[{measuredAt:date,height:170,weight:65,muscle:26,fat:20}];
  assert.deepEqual(buildRoutinePreview(state,"2026-10-14",c,"core",date),buildRoutinePreview({...state,inbody:[]},"2026-10-14",c,"core",date));
});
test("다른 날짜는 로딩 대신 미리보기 버튼과 오늘 이동 버튼을 함께 표시한다",()=>{
  for(const selected of ["2026-10-14","2026-10-16"]){
    const html=renderToStaticMarkup(createElement(PlannerRoutineAction,{selected,today:date,busy:false,onGoToday:()=>{},onGenerate:()=>{},onPreview:()=>{}}));
    assert.ok(html.includes(`${selected} 루틴 미리보기`));assert.ok(html.includes("오늘 날짜로 이동"));assert.ok(html.includes(`선택한 날짜는 ${selected}`));assert.ok(html.includes(`오늘(${date})`));
    assert.ok(!/\sdisabled(?:=|\s|>)/.test(html.match(/<button\b[^>]*>/)![0]));assert.ok(html.includes('aria-busy="false"'));assert.ok(!html.includes("저장·처리 중…"));
  }
});
test("오늘의 생성 버튼은 작업 중일 때만 비활성·처리 중 상태로 바뀐다",()=>{
  const props={selected:date,today:date,busy:false,onGoToday:()=>{},onGenerate:()=>{},onPreview:()=>{}};
  const ready=renderToStaticMarkup(createElement(PlannerRoutineAction,props));assert.ok(ready.includes("오늘의 루틴 만들기"));assert.ok(!/\sdisabled(?:=|\s|>)/.test(ready.match(/<button\b[^>]*>/)![0]));
  for(const selected of [date,"2026-10-16"]){const pending=renderToStaticMarkup(createElement(PlannerRoutineAction,{...props,selected,busy:true}));assert.ok(pending.includes('aria-busy="true"'));assert.ok(pending.includes('disabled=""'));assert.ok(pending.includes("저장·처리 중…"));assert.ok(pending.includes('role="status"'));}
});
test("비활성 커서는 대기 커서가 아니며 명시한 처리 상태에서만 진행 커서를 사용한다",()=>{
  const css=readFileSync("app/globals.css","utf8");assert.ok(css.includes("button:disabled{cursor:not-allowed;"));assert.ok(css.includes('button[aria-busy="true"]{cursor:progress}'));assert.ok(!css.includes("button:disabled{cursor:wait"));
});
test("전체 시간표는 일정 유무와 관계없이 00~24시의 48개 행을 유지한다",()=>{
  const rows=calendarRows(emptyPlanner(),date,false);assert.equal(rows.length,48);assert.ok(rows.every(r=>r.kind==="slot"));assert.equal(rows[0].from,0);assert.equal(rows.at(-1)?.until,1440);assert.equal(rows.at(-1)!.top+SLOT_HEIGHT,1152);
});
test("정리 시간표는 주 전체의 교집합 빈 시간만 생략하고 중간 공백도 접는다",()=>{
  const p={...emptyPlanner(),blocks:[block(),block({id:"later",kind:"once",date:"2026-10-16",start:"14:15",end:"15:10"})]},snapshot=structuredClone(p);
  const rows=calendarRows(p,date,true),gaps=rows.filter(r=>r.kind==="gap");
  assert.deepEqual(gaps.map(r=>[r.from,r.until]),[[0,540],[660,840],[930,1440]]);
  assert.deepEqual(rows.filter(r=>r.kind==="slot").map(r=>r.from),[540,570,600,630,840,870,900]);
  assert.deepEqual(calendarRows(p,"2026-10-12",true),rows,"같은 주의 모든 날짜에 동일한 시간축 적용");assert.deepEqual(p,snapshot);
  const rect=calendarEventRect(rows,855,910)!;assert.equal(rect.top,GAP_HEIGHT*2+SLOT_HEIGHT*4+12);assert.equal(rect.height,44);
});
test("일정 없는 주·주 이동·제외 날짜·종료된 반복도 표시에 반영한다",()=>{
  const p={...emptyPlanner(),blocks:[block({until:"2026-10-15",excludedDates:["2026-10-12",date]}),block({id:"outside",kind:"once",date:"2026-10-22"})]};
  assert.deepEqual(calendarRows(p,date,true),[{kind:"gap",from:0,until:1440,top:0,height:GAP_HEIGHT}]);assert.equal(calendarEventRect(calendarRows(p,date,true),540,600),null);
  assert.ok(calendarRows(p,"2026-10-22",true).some(r=>r.kind==="slot"));
});
test("주 경계를 넘는 야간 일정도 전날의 연속 구간과 다음 날 구간을 남긴다",()=>{
  const p={...emptyPlanner(),blocks:[block({kind:"once",date:"2026-10-11",start:"23:00",end:"01:00"}),block({id:"night",kind:"once",date:"2026-10-18",start:"23:00",end:"02:00"})]};
  const slots=calendarRows(p,date,true).filter(r=>r.kind==="slot");assert.deepEqual(slots.map(r=>r.from),[0,30,1380,1410]);
  assert.deepEqual(calendarRows(p,"2026-10-19",true).filter(r=>r.kind==="slot").map(r=>r.from),[0,30,60,90]);
});
test("짧은 일정과 연속 일정은 생략 구간을 침범하지 않고 같은 경계에서 맞닿는다",()=>{
  const p={...emptyPlanner(),blocks:[block({kind:"once",date,start:"09:29",end:"09:30"}),block({id:"second",kind:"once",date,start:"09:30",end:"10:00"})]},rows=calendarRows(p,date,true);
  const first=calendarEventRect(rows,569,570)!,second=calendarEventRect(rows,570,600)!;assert.equal(first.height,18);assert.equal(first.top+first.height,second.top);
  assert.ok(rows.reduce((n,r)=>n+r.height,0)<1152);assert.equal(calendarEventRect(rows,600,630),null);
});
test("원본 내용 수정은 연결된 반복·개별 배치·보관함에 반영하고 각 날짜와 시간을 보존한다",()=>{
  const original=block({groupId:"family",excludedDates:[date],until:"2026-11-01"}),copy=block({id:"override",groupId:"family",kind:"once",date,start:"14:00",end:"15:00"});
  const unrelated=block({id:"other",groupId:"different",kind:"once",date:"2026-10-16"}),legacy=block({id:"legacy",kind:"once",date:"2026-10-17"});
  const p={...emptyPlanner(),blocks:[original,copy,unrelated,legacy],templates:[{...original,id:"template"}]},snapshot=structuredClone(p);
  const r=editRequest(),next=applyBlockEdit(p,r);
  for(const b of [...next.blocks.slice(0,2),...next.templates])assert.deepEqual(blockContentSchema.parse(b),r.content);
  next.blocks.slice(0,2).forEach((b,i)=>{const before=p.blocks[i];assert.deepEqual({date:b.date,start:b.start,end:b.end,kind:b.kind,weekdays:b.weekdays,until:b.until,excludedDates:b.excludedDates},{date:before.date,start:before.start,end:before.end,kind:before.kind,weekdays:before.weekdays,until:before.until,excludedDates:before.excludedDates});});
  assert.deepEqual(next.blocks.slice(2),p.blocks.slice(2));assert.deepEqual(p,snapshot);assert.equal(blocksForDate(next,date)[0].title,r.content.title);
});
test("기존 블록은 명시 선택해야 연결하며 보관함만 수정할 때 새 일정을 만들지 않는다",()=>{
  const original=block({id:"legacy"}),template={...original,id:"template"};
  const p={...emptyPlanner(),blocks:[original],templates:[template]};
  const onlyTemplate=applyBlockEdit(p,editRequest({groupId:"template",blockIds:[]}));
  assert.deepEqual(onlyTemplate.blocks,p.blocks);assert.equal(onlyTemplate.templates[0].title,"프로젝트 실습");
  const linked=applyBlockEdit(p,editRequest({groupId:"template",blockIds:["legacy"]}));
  assert.equal(linked.blocks[0].groupId,"template");assert.equal(removalCandidates(linked,{kind:"template",item:linked.templates[0],date}).linkedBlocks.length,1);
  assert.throws(()=>applyBlockEdit(p,editRequest({content:{...editRequest().content,title:" "}})));
});
test("저장된 과거·오늘 계획 내용과 부담만 동기화하고 실제 체크인·추천·실천 기록은 보존한다",()=>{
  const p={...emptyPlanner(),blocks:[block({groupId:"family",breakStart:"09:30",breakEnd:"10:00"}),block({id:"class-1-extra",kind:"once",date:"2026-10-12",start:"14:00",end:"15:00"})]};
  const original=buildPlannedDay(a,c,"full",defaultSchedule,[],undefined,"2026-10-12",true,p),id=original.routines[0].id;
  original.statuses[id]="partial";original.notes[id]="유지할 메모";
  const r=editRequest({templateIds:[]}),next=applyBlockEdit(p,r),[updated]=editSavedBlockPlans([original],next,r,defaultSchedule);
  const rows=updated.timeline.filter(t=>/^plan-class-1-2026-10-12(?:-after)?$/.test(t.id));assert.equal(rows.length,2);assert.ok(rows.every(t=>t.title===r.content.title&&t.detail.includes("새 강의실")));
  assert.equal(updated.timeline.find(t=>t.id==="plan-class-1-extra-2026-10-12")?.title,"수업","ID 접두사가 겹치는 별도 블록은 보존");
  assert.deepEqual(updated.timeline.map(t=>[t.id,t.start,t.end]),original.timeline.map(t=>[t.id,t.start,t.end]));
  for(const key of ["routines","statuses","notes","checkin"] as const)assert.deepEqual(updated[key],original[key]);
  assert.ok(updated.planningContext!.mental>original.planningContext!.mental);assert.ok(daySchema.safeParse(updated).success);
  updated.statuses={...updated.statuses,[id]:"done"};
  const [restored]=restoreSavedBlockPlans([updated],[original]);assert.equal(restored.statuses[id],"done");assert.deepEqual(restored.timeline.filter(t=>!t.routineId),original.timeline.filter(t=>!t.routineId));
});
test("밤샘 일정·식사 분류와 핵심 모드의 저장된 부담도 동기화한다",()=>{
  const p={...emptyPlanner(),blocks:[block({kind:"once",date:"2026-10-14",start:"22:00",end:"09:00"})]};
  const original=buildPlannedDay(a,c,"full",defaultSchedule,[],undefined,date,true,p);
  const r=editRequest({templateIds:[],content:{...editRequest().content,category:"meal"}}),next=applyBlockEdit(p,r);
  const [updated]=editSavedBlockPlans([original],next,r,defaultSchedule);
  assert.equal(updated.timeline.find(t=>t.id==="plan-class-1-2026-10-14")?.kind,"meal");
  const core={...original,mode:"core" as const,timeline:[]};
  const [updatedCore]=editSavedBlockPlans([core],next,r,defaultSchedule);assert.equal(updatedCore.planningContext?.mental,5);assert.deepEqual(updatedCore.routines,core.routines);
});

test("원본 연결 ID로 제목이 바뀐 배치를 찾고 같은 제목의 별도 블록은 선택하지 않는다",()=>{
  const original=block({groupId:"family"}),copy=block({id:"copy",title:"다른 이름",groupId:"family",kind:"once",date:"2026-10-16"});
  const legacy=block({id:"legacy"}),unrelated=block({id:"unrelated",groupId:"other"});
  const template={...original,id:"template"};
  const p={...emptyPlanner(),blocks:[original,copy,legacy,unrelated],templates:[template]};
  const candidates=removalCandidates(p,{kind:"block",item:original,date});
  assert.deepEqual(candidates.linkedBlocks.map(b=>b.id),[original.id,copy.id]);
  assert.deepEqual(candidates.legacyBlocks.map(b=>b.id),[legacy.id]);assert.equal(candidates.linkedTemplates[0].id,"template");
  const oldCandidates=removalCandidates(p,{kind:"template",item:{...template,groupId:undefined,id:"old-library"},date});
  assert.equal(oldCandidates.linkedBlocks.length,0,"이름으로 기존 배치를 자동 연결하지 않음");
});
test("오늘 이후 제거는 반복 종료일을 앞당기고 과거 배치·다른 블록·보관함을 보존한다",()=>{
  const p={...emptyPlanner(),blocks:[block(),block({id:"old",kind:"once",date:"2026-10-14"}),block({id:"next",kind:"once",date:"2026-10-16"}),block({id:"other",kind:"once",date:"2026-10-17"})],templates:[{...block(),id:"template"}]};
  const request:RemovalRequest={scope:"future",date,blockIds:["class-1","old","next"],templateIds:["template"],removeLibrary:false};
  const snapshot=structuredClone(p),next=applyBlockRemoval(p,request);
  assert.equal(next.blocks.find(b=>b.id==="class-1")?.until,"2026-10-14");assert.ok(next.blocks.some(b=>b.id==="old"));assert.ok(!next.blocks.some(b=>b.id==="next"));assert.ok(next.blocks.some(b=>b.id==="other"));assert.equal(next.templates.length,1);
  assert.equal(blocksForDate(next,date).length,0);assert.equal(blocksForDate(next,"2026-10-12").length,1);assert.deepEqual(p,snapshot);assert.ok(plannerSchema.safeParse(next).success);
});
test("날짜 하나만 제거와 전체 제거를 구분하고 보관함도 명시 선택한 항목만 제거한다",()=>{
  const p={...emptyPlanner(),blocks:[block(),block({id:"extra",kind:"once",date}),block({id:"outside",kind:"once",date:"2026-10-16"})],templates:[{...block(),id:"template"},{...block(),id:"other-template"}]};
  const request:RemovalRequest={scope:"date",date,blockIds:["class-1","extra","outside"],templateIds:["template"],removeLibrary:true};
  const next=applyBlockRemoval(p,request);assert.equal(blocksForDate(next,date).length,0);assert.ok(next.blocks.some(b=>b.id==="outside"));assert.equal(blocksForDate(next,"2026-10-22").length,1);assert.deepEqual(next.templates.map(t=>t.id),["other-template"]);
  const all=applyBlockRemoval(p,{...request,scope:"all"});assert.equal(all.blocks.length,0);assert.equal(all.templates.length,1);
});
test("저장된 계획 행만 제거하고 실천 기록을 유지하며 되돌릴 때 최신 완료 상태를 덮어쓰지 않는다",()=>{
  const original=buildPlannedDay(a,c,"full",defaultSchedule,[],undefined,"2026-10-12",true,{...emptyPlanner(),blocks:[block()]});
  const id=original.routines[0].id;original.statuses[id]="partial";original.notes[id]="유지";
  const request:RemovalRequest={scope:"all",date,blockIds:["class-1"],templateIds:[],removeLibrary:false};
  const [removed]=removeSavedBlockPlans([original],request);
  assert.ok(!removed.timeline.some(t=>t.id.startsWith("plan-class-1-")));assert.deepEqual(removed.routines,original.routines);assert.deepEqual(removed.statuses,original.statuses);assert.deepEqual(removed.notes,original.notes);
  removed.statuses={...removed.statuses,[id]:"done"};
  const [restored]=restoreSavedBlockPlans([removed],[original]);assert.equal(restored.statuses[id],"done");assert.ok(restored.timeline.some(t=>t.id.startsWith("plan-class-1-")));assert.ok(daySchema.safeParse(restored).success);
  assert.ok(removeSavedBlockPlans([original],{...request,scope:"future"})[0].timeline.some(t=>t.id.startsWith("plan-class-1-")),"오늘 이후 제거는 과거 계획 행을 보존함");
});
test("제외 날짜·종료된 반복과 무기한 반복 및 자정 넘는 일정도 시작일 기준 범위를 따른다",()=>{
  const p={...emptyPlanner(),blocks:[block({excludedDates:[date]}),block({id:"ended",until:"2026-10-13"}),block({id:"night",kind:"once",date:"2026-10-14",start:"22:00",end:"07:00"})]};
  const request:RemovalRequest={scope:"date",date,blockIds:p.blocks.map(b=>b.id),templateIds:[],removeLibrary:false};
  assert.deepEqual(applyBlockRemoval(p,request),p);
  const future=applyBlockRemoval(p,{...request,scope:"future"});assert.ok(future.blocks.some(b=>b.id==="night"));assert.equal(future.blocks.find(b=>b.id==="ended")?.until,"2026-10-13");assert.equal(blocksForDate(future,"2026-10-22").length,0);
});

test("주간 반복은 요일·시작/종료일·해당 날짜 제외에 맞춰 하루로 가져온다",()=>{
  const p={...emptyPlanner(),blocks:[block({until:"2026-10-22",excludedDates:["2026-10-19"]})]};
  assert.equal(mondayOf(date),"2026-10-12");assert.equal(blocksForDate(p,date).length,1);
  for(const d of ["2026-10-11","2026-10-14","2026-10-19","2026-10-26"])assert.equal(blocksForDate(p,d).length,0);
  assert.equal(addDate("2026-12-31",1),"2027-01-01");
});
test("날짜별 추가 일정은 반복 일정과 병합되며 다른 날짜로 새지 않는다",()=>{
  const p={...emptyPlanner(),blocks:[block(),block({id:"meet",kind:"once",date,start:"15:00",end:"16:00",title:"약속"})]};
  const s=scheduleForDate(defaultSchedule,p,date);
  assert.equal(s.events.length,2);assert.ok(s.events.every(e=>e.id.includes(date)));
  assert.equal(scheduleForDate(defaultSchedule,p,"2026-10-22").events.length,1);
  assert.equal(scheduleForDate(s,p,date).events.length,2,"같은 날짜를 다시 가져와도 중복되지 않음");
});
test("요일 반복끼리와 날짜별 일정의 충돌을 반복 시작 경계와 자정 너머까지 검사한다",()=>{
  const p={...emptyPlanner(),blocks:[block(),block({id:"work",date:"2026-10-16",start:"10:00",end:"12:00"})]};
  assert.ok(validatePlanner(p).some(x=>x.includes("겹쳐")));
  const night={...emptyPlanner(),blocks:[block({kind:"once",date,start:"22:00",end:"02:00"}),block({id:"next",kind:"once",date:addDate(date,1),start:"01:00",end:"03:00"})]};
  assert.ok(validatePlanner(night).some(x=>x.includes("겹쳐")));
  assert.equal(occurrencesInWindow(night,addDate(date,1))[0].from,0);
});
test("고정 일정 안의 허용 휴식에 식사 블록을 넣고 중복 식사를 생성하지 않는다",()=>{
  const p={...emptyPlanner(),blocks:[block({start:"09:00",end:"18:00",category:"work",breakStart:"12:00",breakEnd:"13:30"}),block({id:"meal",kind:"once",date,category:"meal",title:"점심",start:"12:30",end:"13:00"})]};
  assert.deepEqual(validatePlanner(p),[]);
  const s=scheduleForDate(defaultSchedule,p,date);assert.deepEqual(validateSchedule(s),[]);
  const timeline=buildTimeline([],s).timeline;
  assert.equal(timeline.filter(t=>t.kind==="meal"&&t.start==="12:30").length,1);
  assert.ok(!timeline.some(t=>t.id==="lunch"));
});
test("날짜 하나만 바꾸면 원래 반복과 대체 일정이 중복되지 않는다",()=>{
  const p={...emptyPlanner(),blocks:[block({excludedDates:[date]}),block({id:"override",kind:"once",date,start:"10:00",end:"12:00"})]};
  assert.deepEqual(validatePlanner(p),[]);assert.equal(blocksForDate(p,date)[0].id,"override");
  assert.equal(blocksForDate(p,"2026-10-22")[0].id,"class-1");
});
test("주간 일정 부담을 루틴에 반영하되 실제 체크인과 직접 만든 루틴·실천 기록을 보존한다",()=>{
  const p={...emptyPlanner(),blocks:[block({start:"09:00",end:"18:00",mental:5,physical:5,breakStart:"12:00",breakEnd:"13:30"})]};
  const initial=buildPlannedDay(a,c,"core",defaultSchedule,[],undefined,date,true,p);
  assert.equal(initial.planningContext?.mental,5);assert.ok(initial.routines.reduce((n,r)=>n+r.minutes,0)<=10);
  assert.deepEqual(initial.checkin,c,"부담 추정이 사용자 실제 컨디션 응답을 덮어쓰지 않음");
  initial.routines[0]={...initial.routines[0],source:"custom"};initial.statuses[initial.routines[0].id]="partial";
  const next=buildPlannedDay(a,{...c,unwell:true},"core",defaultSchedule,[initial],undefined,date,true,p);
  assert.equal(next.statuses[initial.routines[0].id],"partial");assert.ok(next.routines.some(r=>r.source==="custom"));assert.ok(daySchema.safeParse(next).success);
});
test("블록 검증은 빈 제목·잘못된 날짜·같은 시작/끝·빈 요일·잘못된 휴식을 거부한다",()=>{
  for(const b of [block({title:""}),block({date:"2026-02-30"}),block({end:"09:00"}),block({weekdays:[]}),block({breakStart:"08:00",breakEnd:"08:30"})])assert.ok(!plannerBlockSchema.safeParse(b).success);
  assert.ok(!plannerSchema.safeParse({...emptyPlanner(),blocks:[block(),block()]}).success);
  const base={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-v1",answers:a,schedule:defaultSchedule,inbody:[],days:[]};
  assert.ok(stateSchema.safeParse(base).success);assert.ok(stateSchema.safeParse({...base,planner:{...emptyPlanner(),blocks:[block()]}}).success);
});
test("새 일정 없이 기존 사용자의 추천은 동일하며 빈 시간이 없으면 자동 루틴을 억지로 넣지 않는다",()=>{
  const p={...emptyPlanner(),blocks:[block({start:"07:00",end:"23:00"})]};
  const day=buildPlannedDay(a,c,"core",defaultSchedule,[],undefined,date,true,p);
  assert.equal(day.planningContext?.effectiveMinutes,0);assert.equal(day.routines.length,0);assert.ok(day.warnings.length);
});
