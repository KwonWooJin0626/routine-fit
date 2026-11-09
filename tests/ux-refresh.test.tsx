import { growthProposal } from "../lib/growth-proposal";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { applyJournalCommand,humanDocument } from "../lib/activity-journal";
import { commandAlreadyApplied,protectsPetRecords } from "../lib/pet-actions";
import { calculatePet,newPetDocument } from "../lib/pet-engine";
import { defaultAnswers,defaultSchedule,stateSchema,initialCheckin,type AppState } from "../lib/model";
import type { PetRequest } from "../lib/pet-model";
import { lifestyleCharts } from "../lib/lifestyle-charts";
import { plannerBlockSchema } from "../lib/planner-model";
import { scheduleContext } from "../lib/planner";
import { paceCheckin } from "../components/daily-checkin";
import { ActivityWizard } from "../components/activity-wizard";
import { activityProfileSchema,newActivityProfile } from "../lib/activity-profile";
import { FeaturePanel } from "../components/feature-panel";

const now=new Date("2026-11-10T12:00:00Z"),date="2026-11-10";
const state=():AppState=>({version:1,consentAt:now.toISOString(),consentVersion:"2026-10-growth-v1",answers:{...defaultAnswers,name:"검증"},schedule:defaultSchedule,inbody:[],days:[]});
const input=():PetRequest=>({key:randomUUID(),revision:0,appRevision:1,command:{action:"record",record:{title:"독서",type:"growth",start:"2026-11-10T09:00:00Z",end:"2026-11-10T09:30:00Z",source:{kind:"manual",id:"reading",date},intensity:"light",status:"done"}}});
test("미입양 사용자도 실제 기록·차트를 사용할 수 있고 기록 ID와 재시도 영수증을 유지한다",()=>{
  const req=input(),result=applyJournalCommand(null,state(),req,now);
  assert.equal(result.document,null);assert.equal(result.reactionId,undefined);
  assert.ok(stateSchema.safeParse(result.app).success);assert.equal(result.app.activityJournal?.records[0].id,req.key);
  assert.equal(lifestyleCharts(result.app,date,"day","actual").occupiedMinutes,30);
  assert.ok(commandAlreadyApplied(humanDocument(result.app),req));
  assert.throws(()=>commandAlreadyApplied(humanDocument(result.app),{...req,command:{action:"reset",confirm:"강아지 새로 시작"}}));
});
test("강아지 입양·초기화·숨김이 사람의 기존 기록을 지우거나 과거 활동을 보상하지 않는다",()=>{
  const recorded=applyJournalCommand(null,state(),input(),now);
  const adopted=applyJournalCommand(null,recorded.app,{...input(),command:{action:"adopt",name:"솜이"}},now);
  assert.deepEqual(adopted.app.activityJournal?.records,recorded.app.activityJournal?.records);
  assert.equal(calculatePet(adopted.document!,now).stats.learningTotalXP,0);
  const reset=applyJournalCommand(adopted.document,adopted.app,{...input(),command:{action:"reset",confirm:"강아지 새로 시작"}},now);
  assert.deepEqual(reset.app.activityJournal?.records,recorded.app.activityJournal?.records);
  assert.equal(lifestyleCharts(reset.app,date,"day","actual",reset.document).occupiedMinutes,30);
});
test("구형 강아지 기록의 ID·출처·취소 이력과 오래된 사실은 이관 시 유지된다",()=>{
  const old=newPetDocument("솜이",randomUUID(),new Date("2026-11-01T00:00:00Z"));
  const first=applyJournalCommand(old,state(),input(),now);
  const canonical=humanDocument(first.app,first.document),r=canonical.records[0];
  const legacy={...old,records:[{...r,cancelled:true}]},app=state();
  const adopted=applyJournalCommand(legacy,app,{...input(),command:{action:"settings",name:"다시",visible:false,reducedMotion:true}},now);
  assert.deepEqual(adopted.app.activityJournal?.records,[{...r,cancelled:true}]);
});
test("중복·미래·겹친 실제 기록은 거절하며 체크만으로 실제 시간을 만들지 않는다",()=>{
  const original=state(),req=input(),first=applyJournalCommand(null,original,req,now);
  assert.equal(original.activityJournal,undefined);
  assert.throws(()=>applyJournalCommand(null,first.app,input(),now),/이미 반영/);
  const overlap=input();if(overlap.command.action!=="record")throw Error();overlap.command.record.source.id="second";
  assert.throws(()=>applyJournalCommand(null,first.app,overlap,now),/겹쳐/);
  overlap.command.record.end="2026-11-11T12:00:00Z";assert.throws(()=>applyJournalCommand(null,first.app,overlap,now),/실제 시각/);
});
test("부담 기본값·출처 미확인은 시간 파이에만 반영하고 확인된 값만 부담으로 집계한다",()=>{
  const app=state(),block=plannerBlockSchema.parse({id:"s",title:"수업",category:"study",start:"09:00",end:"10:00",mental:5,physical:5,shade:1,location:"",task:"",kind:"once",date,weekdays:[]});
  app.planner={setupComplete:true,blocks:[block],templates:[]};
  assert.equal(lifestyleCharts(app,date,"day","planned").occupiedMinutes,60);
  assert.equal(lifestyleCharts(app,date,"day","planned").mental,null);
  assert.equal(scheduleContext(app.schedule,app.planner,date,initialCheckin(app.answers)).burdenKnown,false);
  block.mentalSource="user";block.physicalSource="user";
  assert.equal(lifestyleCharts(app,date,"day","planned").mental,5);
  assert.equal(scheduleContext(app.schedule,app.planner,date,initialCheckin(app.answers)).burdenKnown,true);
});
test("한 문항 페이스는 분량만 변경하며 에너지·수면·스트레스 응답을 생성하지 않는다",()=>{
  const c={...initialCheckin(defaultAnswers),reported:false,sleepKnown:false,stressKnown:false};
  const light=paceCheckin(c,"light"),more=paceCheckin(c,"more");
  assert.ok(light.minutes<more.minutes);
  for(const key of ["sleep","energy","stress","reported","sleepKnown","stressKnown"] as const){assert.equal(light[key],c[key]);assert.equal(more[key],c[key]);}
});
test("빠른 독서 프로필은 불필요한 문항 없이 저장하고 새 운동의 안전 조건은 계속 확인한다",()=>{
  const reading={...newActivityProfile("reading"),questionFlow:"quick-v1" as const,goal:"habit",activity:"read",days:[2],weekly:null,weeklySource:"none" as const,fields:{format:"paper",record:"none"}};
  assert.ok(activityProfileSchema.safeParse(reading).success);
  const exercise={...reading,domain:"exercise" as const,goal:"habit",activity:"run",fields:{place:"outside"}};
  assert.equal(activityProfileSchema.safeParse(exercise).success,false);
  const app=state();const html=renderToStaticMarkup(<ActivityWizard state={app} busy={false} error="" onComplete={async()=>{throw Error();}} onMediaSave={async()=>{}} onClose={()=>{}} onPlan={()=>{}}/>);
  assert.match(html,/어떤 분야부터/);assert.doesNotMatch(html,/현재에는 얼마나|주간 총 목표 시간/);
});
test("접힌 기능은 키보드로 누르는 버튼이며 내용은 팝업을 열 때만 마운트한다",()=>{
  const html=renderToStaticMarkup(<FeaturePanel title="처음 기입된 정보" caption="저장한 정보를 확인·수정"><div>긴 상세 내용</div></FeaturePanel>);
  assert.match(html,/aria-haspopup="dialog"/);assert.match(html,/aria-expanded="false"/);assert.doesNotMatch(html,/긴 상세 내용|feature-emoji/);
});

test("다음 주 조정은 확인할 추가 제안이며 고정 일정과 기존 기록을 바꾸지 않는다",()=>{
  const app=state();app.planner={setupComplete:true,templates:[],blocks:[plannerBlockSchema.parse({id:"fixed",title:"수업",category:"study",kind:"fixed",date,start:"09:00",end:"10:00",weekdays:[1],excludedDates:[],location:"",task:"",mental:3,physical:2,shade:1})]};
  const before=structuredClone(app),proposal=growthProposal(app,date,date);
  assert.equal(proposal?.date,"2026-11-16");assert.equal(proposal?.start,"10:00");assert.equal(proposal?.mentalSource,"default");assert.deepEqual(app,before);
});
