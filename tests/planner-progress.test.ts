import test from "node:test";
import assert from "node:assert/strict";
import { emptyPlanner, plannerBlockSchema, plannerSchema } from "../lib/planner-model";
import { recordOccurrence } from "../lib/planner-progress";
import { applyBlockRemoval } from "../lib/planner-removal";
import { applyBlockEdit } from "../lib/planner-edit";

const block=plannerBlockSchema.parse({id:"repeat",title:"수업",category:"study",location:"강의실",task:"학습",start:"23:00",end:"01:00",mental:3,physical:2,shade:1,kind:"fixed",date:"2026-10-01",weekdays:[4]});
const planner={...emptyPlanner(),blocks:[block]};
test("일정 완료는 발생 날짜 단위이며 다른 주에 전파되지 않는다",()=>{
  const next=recordOccurrence(planner,block,"2026-10-15","done","2026-10-22");
  assert.equal(next.records?.length,1);assert.equal(next.records?.[0].date,"2026-10-15");
  assert.ok(!next.records?.some(r=>r.date==="2026-10-22"));
  assert.equal(planner.records,undefined);assert.ok(plannerSchema.safeParse(next).success);
});
test("완료 취소와 일부 진행·미진행 변경은 같은 발생 기록만 수정한다",()=>{
  const done=recordOccurrence(planner,block,"2026-10-15","done","2026-10-22");
  const partial=recordOccurrence(done,block,"2026-10-15","partial","2026-10-22");
  assert.equal(partial.records?.length,1);assert.equal(partial.records?.[0].status,"partial");
  assert.equal(recordOccurrence(partial,block,"2026-10-15","partial","2026-10-22").records?.length,0);
});
test("미래·해당 날짜에 없는 일정은 완료할 수 없다",()=>{
  assert.throws(()=>recordOccurrence(planner,block,"2026-10-29","done","2026-10-22"));
  assert.throws(()=>recordOccurrence(planner,block,"2026-10-21","done","2026-10-22"));
});
test("일정 일괄 수정·삭제는 수행 당시 제목·시각·기록을 보존한다",()=>{
  const done=recordOccurrence(planner,block,"2026-10-15","done","2026-10-22");
  const edited=applyBlockEdit(done,{groupId:"repeat",blockIds:["repeat"],templateIds:[],content:{title:"새 이름",category:"study",location:"",task:"",mental:1,physical:1,shade:1}});
  assert.equal(edited.records?.[0].title,"수업");
  const removed=applyBlockRemoval(edited,{scope:"all",date:"2026-10-22",blockIds:["repeat"],templateIds:[],removeLibrary:false});
  assert.equal(removed.blocks.length,0);assert.deepEqual(removed.records,done.records);
});
test("같은 블록·날짜 중복 수행 기록은 저장 스키마에서 거절한다",()=>{
  const next=recordOccurrence(planner,block,"2026-10-15","done","2026-10-22");
  assert.ok(!plannerSchema.safeParse({...next,records:[next.records![0],next.records![0]]}).success);
});
