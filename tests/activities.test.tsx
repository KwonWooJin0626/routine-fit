import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { activityProfileSchema, activityPreferencesSchema, activityAllocation, newActivityProfile, type ActivityDomain, type ActivityProfile } from "../lib/activity-profile";
import { activityCatalog, baseActivityQuestions, activityDefinition, activityCandidates } from "../lib/activity-catalog";
import { activityRoutine, recommendActivities } from "../lib/activity-recommendations";
import { buildDay, reviseDayRoutines } from "../lib/engine";
import { buildPlannedDay } from "../lib/planner";
import { defaultAnswers, defaultSchedule, initialCheckin, stateSchema, type AppState } from "../lib/model";
import { emptyBasicProfile } from "../lib/basic-profile";
import { ActivityWizard } from "../components/activity-wizard";
import { ActivityGoals } from "../components/activity-goals";
import { createStateHandlers, type StateRepository } from "../lib/state-api";

const date="2026-10-31";
function profile(domain:ActivityDomain,id?:string):ActivityProfile{
  const activity=activityCatalog.find(a=>a.domain===domain&&(!id||a.id===id))!;
  const fields=Object.fromEntries([...baseActivityQuestions[domain],...activity.questions].filter(q=>q.options).map(q=>[q.key,Object.keys(q.options!)[0]]));
  if(domain==="exercise")Object.assign(fields,{place:"any",experience:"regular",restriction:"none",overhead:"0"});
  return {...newActivityProfile(domain),goal:activity.goals[0],activity:activity.id,current:"regular",daily:30,weekly:90,days:[1,3,6],fields};
}
const answers=(profiles:ActivityProfile[])=>({...defaultAnswers,name:"검증용",basic:emptyBasicProfile(),activities:{version:1 as const,route:"routine" as const,profiles},available:60});
const state=(profiles:ActivityProfile[]):AppState=>({version:1,consentVersion:"2026-10-growth-v1",consentAt:"2026-10-31T00:00:00Z",answers:answers(profiles),schedule:defaultSchedule,days:[],inbody:[]});
test("7개 분야의 모든 활동이 유효한 설문 답변과 다른 실행 내용을 만들며 직렬화된다",()=>{
  for(const activity of activityCatalog){
    const p=profile(activity.domain,activity.id);
    assert.ok(activityProfileSchema.safeParse(p).success,activity.id);
    assert.ok(stateSchema.safeParse(state([p])).success);
    const r=activityRoutine(p,20);assert.equal(r.activity?.domain,p.domain);assert.ok(r.detail.length>10);assert.ok(r.minutes===20);
  }
});
test("하루·주간·요일의 불일치와 중복·불확실한 운동·잘못된 활동·응답을 저장 전에 거절한다",()=>{
  const p=profile("exercise","walk");
  for(const patch of [{weekly:120},{days:[1,1,6]},{activity:"invented"},{fields:{...p.fields,restriction:"unknown"}},{fields:{...p.fields,experience:"unknown"}},{goal:"__proto__"},{fields:{...p.fields,place:"invented"}}])assert.ok(!activityProfileSchema.safeParse({...p,...patch}).success);
  assert.ok(activityProfileSchema.safeParse({...profile("exercise","prepare"),fields:{interest:"unknown",place:"home"}}).success);
  assert.ok(!activityPreferencesSchema.safeParse({version:1,route:"routine",profiles:[p,profile("reading"),profile("study")]}).success);
  assert.ok(!activityProfileSchema.safeParse({...profile("study"),fields:{...profile("study").fields,deadline:"2026-02-30"}}).success);
  assert.ok(!activityCandidates({...p,fields:{...p.fields,place:"home"}}).some(a=>a.id==="gym"));
});
test("주간 목표는 요일에 정확히 분배하고 주간 목표 없는 활동은 선택한 날에만 추천한다",()=>{
  const p={...profile("reading"),daily:30,weekly:50,days:[1,3,6]};
  assert.deepEqual(activityAllocation(p),{1:17,3:17,6:16});
  const a=answers([p]),c={...initialCheckin(a),energy:3,stress:3};
  assert.equal(recommendActivities(a,c,[],date)[0].minutes,16);
  assert.equal(recommendActivities(a,c,[],"2026-11-01").length,0);
  assert.equal(recommendActivities(answers([{...p,weekly:null,weeklySource:"none"}]),c,[],date)[0].minutes,30);
});
test("추천 후보는 장소·선호로 달라지고 책·언어·준비물·음악 장르·초보 상태를 반영한다",()=>{
  const p=profile("exercise","walk");assert.equal(activityCandidates({...p,fields:{...p.fields,interest:"run"}})[0].id,"run");
  assert.match(activityRoutine({...profile("exercise","home"),fields:{...profile("exercise","home").fields,noise:"no",equipment:"none"}},20).detail,/점프 없는/);
  assert.match(activityRoutine({...profile("reading"),fields:{...profile("reading").fields,book:"테스트 책",record:"summary",format:"ebook"}},20).detail,/테스트 책/);
  assert.match(activityRoutine({...profile("rest","music"),fields:{...profile("rest","music").fields,sound:"vocal"}},20).detail,/보컬/);
  const a=answers([{...profile("study"),current:"none"}]);assert.ok(recommendActivities(a,initialCheckin(a),[],date)[0].minutes<=10);
});
test("여러 분야가 전체 시간 예산을 공유하며 이동·준비도 예약하고 목표를 덮어쓰지 않는다",()=>{
  const p={...profile("exercise","walk"),fields:{...profile("exercise","walk").fields,overhead:"10"}},a=answers([p,profile("reading")]);
  const snapshot=structuredClone(a),c={...initialCheckin(a),minutes:35};
  const rows=recommendActivities(a,c,[],date);assert.ok(rows.reduce((n,r)=>n+r.minutes+(r.activity?.overheadMinutes??0),0)<=35);assert.deepEqual(a,snapshot);
  const d=buildDay(a,c,"full",defaultSchedule,[],undefined,date);assert.ok(d.timeline.some(t=>t.routineId===rows[0].id));
});
test("당일 피로·쉬기·운동 제한과 피드백을 반영하고 수동·완료 루틴·실제 시간은 유지한다",()=>{
  const a=answers([profile("exercise","walk"),profile("reading")]),c=initialCheckin(a);
  assert.ok(!recommendActivities(a,{...c,reported:true,energy:1},[],date).some(r=>r.category==="move"));
  assert.deepEqual(recommendActivities(a,{...c,activityMode:"rest"},[],date),[]);
  const old=buildDay(a,c,"core",defaultSchedule,[],undefined,"2026-10-28"),r=old.routines.find(r=>r.activity?.domain==="reading")!;
  old.activityFeedback={[r.id]:{reason:"hard",actualMinutes:9,recordedAt:"2026-10-28T03:00:00Z"}};
  assert.ok(recommendActivities(a,c,[old],date).find(r=>r.activity?.domain==="reading")!.minutes<r.minutes);
  const day=buildDay(a,c,"core",defaultSchedule,[],undefined,date);day.statuses[day.routines[0].id]="done";day.activityFeedback={[day.routines[0].id]:{actualMinutes:7,recordedAt:"2026-10-31T03:00:00Z"}};
  day.routines.push({...day.routines[0],id:"manual-keep",source:"custom"});
  const next=buildDay(a,{...c,activityMode:"rest"},"core",defaultSchedule,[day],undefined,date);
  assert.ok(next.routines.some(r=>r.id==="manual-keep"));assert.equal(next.statuses[day.routines[0].id],"done");assert.equal(next.activityFeedback?.[day.routines[0].id].actualMinutes,7);
});
test("기존 운동 일정은 중복 배치하지 않고 완료를 추정하지 않으며 전체 계획의 겹침을 피한다",()=>{
  const a=answers([profile("exercise","walk")]),c=initialCheckin(a);
  const planner={setupComplete:true,templates:[],blocks:[{id:"run",title:"등록 운동",category:"exercise" as const,location:"공원",task:"",start:"15:00",end:"15:30",mental:2,physical:2,shade:1,kind:"once" as const,date,weekdays:[],excludedDates:[]}]};
  const day=buildPlannedDay(a,c,"full",defaultSchedule,[],undefined,date,true,planner),r=day.routines[0];
  assert.equal(r.minutes,0);assert.equal(r.activity?.linkedEvent,`plan-run-${date}`);assert.ok(!day.statuses[r.id]);assert.ok(!day.timeline.some(t=>t.routineId===r.id));
});
test("기존 계정은 추가 질문 없이 열리고 첫 화면은 두 시작 경로를 제공한다",()=>{
  const legacy=state([]);delete legacy.answers.activities;
  assert.ok(stateSchema.safeParse(legacy).success);
  const html=renderToStaticMarkup(<ActivityWizard state={legacy} busy={false} error="" onComplete={()=>{}} onClose={()=>{}} onPlan={()=>{}}/>);
  assert.match(html,/먼저 루틴 추천받기/);assert.match(html,/일정에 맞춰 추천받기/);assert.doesNotMatch(html,/BMI/);
  const s=state([profile("reading")]);s.days=[buildDay(s.answers,initialCheckin(s.answers),"core",defaultSchedule,[],undefined,date)];s.days[0].statuses[s.days[0].routines[0].id]="done";
  const goals=renderToStaticMarkup(<ActivityGoals state={s} busy={false} onRefine={()=>{}} onPlan={()=>{}}/>);assert.match(goals,/직접 기록한 실제 시간/);assert.doesNotMatch(goals,/<strong>30분/);
});
test("완료한 분야가 다음 분야의 예산을 소모하지 않고 계획표 시간 선택은 빈 슬롯을 안내한다",()=>{
  const a=answers([profile("exercise","walk"),{...profile("reading"),when:"calendar"}]),c={...initialCheckin(a),minutes:30};
  const old=buildDay(a,c,"core",defaultSchedule,[],undefined,date);old.statuses[old.routines[0].id]="done";
  const next=buildDay(a,c,"core",defaultSchedule,[old],undefined,date);
  assert.ok(next.routines.some(r=>r.activity?.domain==="reading"));assert.equal(next.routines.find(r=>r.activity?.domain==="reading")?.minutes,30);
  assert.match(next.routines.find(r=>r.activity?.domain==="reading")?.preferredTime??"",/^\d{2}:\d{2}$/);
  assert.ok(!next.warnings.some(w=>w.includes("보다 많아요")));
});
test("희망 시점이 아침인 휴식이 취침 직전으로 강제되지 않으며 잘못된 실제 시간은 거절한다",()=>{
  const p={...profile("rest","quiet"),when:"morning" as const},a=answers([p]),c=initialCheckin(a);
  const day=buildDay(a,c,"full",defaultSchedule,[],undefined,date),slot=day.timeline.find(t=>t.routineId===day.routines[0].id);
  assert.ok(slot);assert.ok(slot.start<"12:00");
  const invalid={...state([p]),days:[{...day,activityFeedback:{[day.routines[0].id]:{actualMinutes:-1,recordedAt:new Date().toISOString()}}}]};
  assert.ok(!stateSchema.safeParse(invalid).success);
});
test("인증된 저장 경계에서 새 목표·실천 시간이 왕복하고 구버전 revision·다른 계정을 차단한다",async()=>{
  const db=new Map<string,{payload:string;revision:number}>();const repo:StateRepository={get:async id=>db.get(id)??null,save:async(id,payload,revision)=>{if((db.get(id)?.revision??0)!==revision)return null;db.set(id,{payload,revision:revision+1});return revision+1;},remove:async id=>{db.delete(id);}};
  const user=createStateHandlers(async()=>"synthetic-a",repo),other=createStateHandlers(async()=>"synthetic-b",repo),s=state([profile("reading")]);
  s.days=[buildDay(s.answers,initialCheckin(s.answers),"core",defaultSchedule,[],undefined,date)];const r=s.days[0].routines[0];s.days[0].activityFeedback={[r.id]:{actualMinutes:12,reason:"okay",recordedAt:new Date().toISOString()}};
  const request=()=>new Request("https://routine.test/api/state",{method:"PUT",headers:{origin:"https://routine.test","content-type":"application/json"},body:JSON.stringify({state:s,revision:0})});
  assert.equal((await user.PUT(request())).status,200);const read=await (await user.GET()).json();assert.equal(read.state.answers.activities.profiles[0].domain,"reading");assert.equal(read.state.days[0].activityFeedback[r.id].actualMinutes,12);assert.equal((await user.PUT(request())).status,409);assert.equal((await (await other.GET()).json()).state,null);
});
