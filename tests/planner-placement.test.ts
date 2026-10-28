import test from "node:test";
import assert from "node:assert/strict";
import { emptyPlanner, type PlannerBlock } from "../lib/planner-model";
import { placeBlockRanges } from "../lib/planner-placement";
import { blocksForDate } from "../lib/planner";
let serial=0;
const id=()=>`placement-test-${++serial}`;
const block:PlannerBlock={id:"draft",title:"집중 학습",category:"study",location:"도서관",task:"강의 복습",start:"09:00",end:"11:00",mental:3,physical:1,shade:2,kind:"fixed",date:"2026-10-26",weekdays:[1],excludedDates:[]};
const ranges=[{date:"2026-10-26",start:"09:00",end:"11:00"},{date:"2026-10-28",start:"14:00",end:"15:30"}];

test("요일마다 다른 시간을 저장하고 다음 주에도 각 요일의 시간을 유지한다",()=>{
  const planner=emptyPlanner(),before=structuredClone(planner);
  const next=placeBlockRanges(planner,block,ranges,"group",true,id);
  assert.deepEqual(planner,before);assert.equal(next.blocks.length,2);assert.equal(next.templates.length,1);
  assert.deepEqual(blocksForDate(next,"2026-11-02").map(b=>[b.start,b.end]),[["09:00","11:00"]]);
  assert.deepEqual(blocksForDate(next,"2026-11-04").map(b=>[b.start,b.end]),[["14:00","15:30"]]);
  assert.equal(blocksForDate(next,"2026-11-03").length,0);
  assert.ok([...next.blocks,...next.templates].every(b=>b.groupId==="group"));
});
test("날짜별 일정은 선택한 날짜만 배치하고 기존 템플릿·기록은 보존한다",()=>{
  const base=placeBlockRanges(emptyPlanner(),{...block,kind:"once"},ranges,"group",true,id);
  const p={...base,records:[{blockId:base.blocks[0].id,date:ranges[0].date,status:"done" as const,title:block.title,start:block.start,end:block.end,recordedAt:"2026-10-26T03:00:00Z"}]};
  const next=placeBlockRanges(p,{...block,kind:"once"},[{date:"2026-10-30",start:"23:30",end:"00:00"}],"group",false,id);
  assert.deepEqual(next.records,p.records);assert.deepEqual(next.templates,p.templates);
  assert.equal(blocksForDate(next,"2026-11-02").length,0);assert.equal(next.blocks.at(-1)?.end,"00:00");
});
test("선택 사이·기존 일정·다음 날 자정 겹침은 일부 저장 없이 거절한다",()=>{
  const p=emptyPlanner(),before=structuredClone(p);
  assert.throws(()=>placeBlockRanges(p,block,[ranges[0],{...ranges[0],start:"10:00"}],"group",false,id),/겹쳐요/);
  const existing=placeBlockRanges(p,{...block,kind:"once"},[{date:"2026-10-27",start:"23:00",end:"01:00"}],"old",false,id);
  assert.throws(()=>placeBlockRanges(existing,{...block,kind:"once"},[{date:"2026-10-28",start:"00:30",end:"02:00"}],"group",false,id),/겹쳐요/);
  assert.deepEqual(p,before);assert.equal(existing.blocks.length,1);
});
test("쉬는 시간은 각 시작 시각으로 이동하고 짧은 블록이나 종료일 오류를 검증한다",()=>{
  const withBreak={...block,breakStart:"09:30",breakEnd:"10:00"};
  const next=placeBlockRanges(emptyPlanner(),withBreak,ranges,"group",false,id);
  assert.equal(next.blocks[1].breakStart,"14:30");assert.equal(next.blocks[1].breakEnd,"15:00");
  assert.throws(()=>placeBlockRanges(emptyPlanner(),withBreak,[{...ranges[1],end:"14:45"}],"group",false,id),/쉬는 시간/);
  assert.throws(()=>placeBlockRanges(emptyPlanner(),{...block,until:"2026-10-27"},ranges,"group",false,id),/종료일/);
  assert.throws(()=>placeBlockRanges(emptyPlanner(),block,[],"group",false,id),/하나 이상/);
  assert.throws(()=>placeBlockRanges(emptyPlanner(),block,[{...ranges[0],end:"09:00"}],"group",false,id),/다르게/);
});
