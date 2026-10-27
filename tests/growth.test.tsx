import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { BasicOnboarding } from "../components/basic-onboarding";
import { basicProfileSchema,emptyBasicProfile } from "../lib/basic-profile";
import { defaultAnswers,defaultSchedule,initialCheckin,stateSchema,type AppState } from "../lib/model";
import { buildDay } from "../lib/engine";
import { buildPlannedDay } from "../lib/planner";
import { growthAnalysis } from "../lib/growth-analysis";
import { analyze } from "../lib/lifestyle-analysis";
import { rankIngredients,supplementHolds } from "../lib/nutrition";
import { emptyNutritionProfile } from "../lib/nutrition-profile";
import { wordForDate } from "../lib/daily-words";
import { GrowthAnalysis } from "../components/growth-analysis";
import { withGrowthProfile } from "../lib/growth-migration";
import { growthCatalog } from "../lib/growth-routines";

const a={...defaultAnswers,name:"합성 예시",basic:emptyBasicProfile()},date="2026-10-27";
const state=():AppState=>({version:1,consentAt:"2026-10-27T00:00:00.000Z",consentVersion:"2026-10-v1",answers:a,schedule:defaultSchedule,inbody:[],days:[]});
test("기초 질문은 동의·사용 흐름부터 보여주며 이전의 긴 설문이나 계획 방식 선택을 강제하지 않는다",()=>{
  const html=renderToStaticMarkup(<BasicOnboarding busy={false} error="" onComplete={()=>{}} onClose={()=>{}}/>);
  assert.ok(html.includes("계획표 작성"));assert.ok(html.includes("동의해요"));assert.ok(!html.includes("연령대"));assert.ok(!html.includes("즉흥형"));assert.ok(html.includes("disabled"));
});
test("수면 범위 화면은 정확한 시간 입력을 강제하거나 범위를 중간값으로 바꾸지 않는다",()=>{
  const answers={...a,basic:{...a.basic,sleepRange:"5-7" as const}};
  const html=renderToStaticMarkup(<BasicOnboarding draft={{answers,step:3}} busy={false} error="" onComplete={()=>{}} onClose={()=>{}}/>);
  assert.ok(html.includes("5~7시간 미만"));assert.ok(html.includes("3시간 미만"));assert.ok(!html.includes('type="number"'));
  assert.equal(stateSchema.parse({...state(),answers}).answers.basic?.sleepRange,"5-7");
  assert.equal(initialCheckin(answers).sleepKnown,false);
});
test("기초 프로필은 생략 가능한 신체 수치·미확인과 비복용을 구분하고 모순·중복을 거절한다",()=>{
  assert.ok(basicProfileSchema.safeParse(emptyBasicProfile()).success);
  assert.ok(!basicProfileSchema.safeParse({...a.basic,height:0}).success);
  assert.ok(!basicProfileSchema.safeParse({...a.basic,supplementStatus:"none",supplements:["d"]}).success);
  assert.ok(!basicProfileSchema.safeParse({...a.basic,supplementStatus:"yes",supplements:["d","d"]}).success);
});
test("새 프로필에서는 이전 구조의 기본값으로 식품·영양소를 추천하거나 건강 점수를 만들지 않는다",()=>{
  assert.deepEqual(rankIngredients({...a,fish:0,protein:0,vegetables:0,fruit:0}),[]);
  assert.ok(supplementHolds(a,emptyNutritionProfile()).some(s=>s.includes("현재 제품")));
  assert.ok(analyze(a).every(row=>row.metrics.length===0));
  const day=buildDay(a,initialCheckin(a),"core",defaultSchedule,[],undefined,date);
  assert.ok(day.routines.length>=2);assert.ok(day.routines.every(r=>r.id.startsWith("growth-")));assert.ok(!day.routines.some(r=>r.category==="food"));
});
test("목표·집중 시간·오늘 컨디션과 계획 부담을 반영하면서 직접 담은 루틴과 완료 기록은 유지한다",()=>{
  const answers={...a,basic:{...a.basic,growthGoal:"study" as const,focusTime:"evening" as const}},c=initialCheckin(answers);
  const day=buildDay(answers,c,"core",defaultSchedule,[],undefined,date);
  assert.ok(day.routines.some(r=>r.id==="growth-focus"&&r.when.includes("저녁")));
  const low=buildDay(answers,{...c,energy:1},"core",defaultSchedule,[],undefined,date);
  assert.ok(!low.routines.some(r=>r.id==="growth-focus"));assert.ok(low.routines.reduce((n,r)=>n+r.minutes,0)<=5);
  day.routines.push({...day.routines[0],id:"custom-kept",source:"custom"});day.statuses[day.routines[0].id]="done";
  const next=buildDay(answers,{...c,energy:1},"core",defaultSchedule,[day],undefined,date);
  assert.ok(next.routines.some(r=>r.id==="custom-kept"));assert.equal(next.statuses[day.routines[0].id],"done");
  const planned=buildPlannedDay(answers,c,"core",defaultSchedule,[],undefined,date,true,{setupComplete:true,templates:[],blocks:[{id:"work",title:"집중 일정",category:"study",location:"",task:"",start:"09:00",end:"18:00",mental:5,physical:1,shade:1,kind:"once",date,weekdays:[],excludedDates:[]}]});
  assert.ok(planned.planningContext);assert.ok(planned.routines.reduce((n,r)=>n+r.minutes,0)<=10);
});
test("계획 등록 여부와 실행 기록을 구분하고 일부 작성한 주를 전체 관측으로 오해하지 않는다",()=>{
  const s=state();assert.equal(growthAnalysis(s,date).unlocked,false);
  s.planner={setupComplete:true,templates:[],blocks:[{id:"one",title:"수업",category:"study",location:"",task:"",start:"09:00",end:"10:00",mental:3,physical:1,shade:1,kind:"once",date,weekdays:[],excludedDates:[]}]};
  const result=growthAnalysis(s,date);assert.equal(result.coveredDays,1);assert.equal(result.plannedMinutes,60);assert.equal(result.done,0);assert.equal(result.routineDays.length,0);
  const html=renderToStaticMarkup(<GrowthAnalysis state={s} onPlan={()=>{}} onRefine={()=>{}}/>);assert.ok(html.includes("예정 일정 기준"));assert.ok(html.includes("실행 기록 기준"));
});
test("자체 작성 글귀는 같은 날짜·시점에 안정적이고 기존 계정 형식도 읽을 수 있다",()=>{
  assert.equal(wordForDate(date,"morning"),wordForDate(date,"morning"));assert.notEqual(wordForDate(date,"morning"),wordForDate(date,"evening"));
  const legacy=state();delete legacy.answers.basic;assert.ok(stateSchema.safeParse(legacy).success);
  assert.ok(stateSchema.safeParse({...state(),growth:{hideQuotes:false,reflections:{[date]:"책을 펼쳤어요"}}}).success);
});
test("기존 상세 숫자·사용자 루틴을 보존한 채 자기개발 요약으로 전환하고 음악·독서 선택지를 유지한다",()=>{
  const old=state();delete old.answers.basic;old.answers.sleepHours=6.25;old.answers.currentSupplements="기존 제품 기록";
  const snapshot=structuredClone(old),next=withGrowthProfile(old);
  assert.deepEqual(old,snapshot);assert.equal(next.answers.sleepHours,6.25);assert.equal(next.answers.currentSupplements,"기존 제품 기록");assert.equal(next.answers.basic?.sleepRange,"5-7");assert.equal(next.answers.basic?.origin,"legacy");
  const catalog=growthCatalog();assert.ok(catalog.length>=20);assert.ok(catalog.some(r=>r.guidance?.kind==="music"));assert.ok(catalog.some(r=>r.guidance?.kind==="reading"));assert.ok(stateSchema.safeParse(next).success);
});
