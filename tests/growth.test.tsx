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
import { lifestyleCharts,partitionTime,plannedLoad,actualTimeSpans,timeCategoryColor } from "../lib/lifestyle-charts";
import { plannerBlockSchema,type PlannerBlock } from "../lib/planner-model";
import { newPetDocument } from "../lib/pet-engine";
import type { PetExecution } from "../lib/pet-model";
import { LifestyleCharts } from "../components/lifestyle-charts";

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
test("긴 성분 목록은 한 화면 여섯 항목으로 나눠 다중 선택을 유지한다",()=>{
  const answers={...a,basic:{...a.basic,supplementStatus:"yes" as const,supplements:["biotin" as const]}};
  const html=renderToStaticMarkup(<BasicOnboarding draft={{answers,step:7}} busy={false} error="" onComplete={()=>{}} onClose={()=>{}}/>);
  assert.ok(html.includes("다음 항목"));assert.ok(html.includes("1개 선택"));assert.ok(html.includes("비타민 B12"));assert.ok(!html.includes(">비오틴 · B7</button>"));
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
test("계획 등록 여부와 실행 기록을 구분하고 일부 작성한 주를 전체 관측으로 오해하지 않는다",context=>{
  context.mock.timers.enable({apis:["Date"],now:new Date(`${date}T12:00:00+09:00`)});
  const s=state();assert.equal(growthAnalysis(s,date).unlocked,false);
  s.planner={setupComplete:true,templates:[],blocks:[{id:"one",title:"수업",category:"study",location:"",task:"",start:"09:00",end:"10:00",mental:3,physical:1,shade:1,kind:"once",date,weekdays:[],excludedDates:[]}]};
  const result=growthAnalysis(s,date);assert.equal(result.coveredDays,1);assert.equal(result.plannedMinutes,60);assert.equal(result.done,0);assert.equal(result.routineDays.length,0);
  const html=renderToStaticMarkup(<GrowthAnalysis date="2026-11-09" onDate={()=>{}} state={s} onPlan={()=>{}} onRefine={()=>{}}/>);assert.ok(html.includes("선택한 주의 요약"));assert.match(html,/aria-haspopup="dialog"/);
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

const chartBlock=(patch:Partial<PlannerBlock>={})=>plannerBlockSchema.parse({id:"study",title:"강의",mentalSource:"user",physicalSource:"user",category:"study",start:"09:00",end:"11:00",mental:3,physical:1,shade:1,location:"",task:"",kind:"once",date,weekdays:[],...patch});
const chartState=(blocks:PlannerBlock[]):AppState&{planner:NonNullable<AppState["planner"]>}=>({...state(),planner:{setupComplete:true,templates:[],blocks}});
test("하루 24시간과 주간 168시간은 미등록 날짜까지 포함하고 카테고리 설정 색을 공유한다",()=>{
  const s={...chartState([chartBlock()]),planner:{...chartState([chartBlock()]).planner,categoryColors:{study:145}}};
  const day=lifestyleCharts(s,date,"day","planned"),week=lifestyleCharts(s,date,"week","planned");
  assert.equal(day.slices.reduce((n,s)=>n+s.minutes,0),1440);assert.equal(week.slices.reduce((n,s)=>n+s.minutes,0),10080);
  assert.equal(day.slices.find(s=>s.key==="study")!.minutes,120);assert.equal(week.coveredDays,1);assert.equal(week.slices.find(s=>s.key==="unregistered")!.minutes,9960);
  assert.equal(timeCategoryColor("study",s),"hsl(145 60% 54%)");assert.equal(day.slices[0].color,timeCategoryColor("study",s));
  assert.equal(lifestyleCharts(state(),date,"day","planned").slices[0].minutes,1440);
});
test("같은 분야·다른 분야·세 겹 일정은 겹친 시간을 별도 표시하고 24시간에 중복 합산하지 않는다",()=>{
  const s=chartState([chartBlock(),chartBlock({id:"work",title:"업무",category:"work",start:"10:00",end:"12:00"}),chartBlock({id:"second-study",title:"과제",start:"10:30",end:"11:30"})]);
  const result=lifestyleCharts(s,date,"day","planned");assert.equal(result.occupiedMinutes,180);assert.equal(result.overlapMinutes,90);assert.equal(result.slices.reduce((n,s)=>n+s.minutes,0),1440);
  assert.equal(result.slices.find(s=>s.key==="study")!.minutes,60);assert.equal(result.slices.find(s=>s.key==="work")!.minutes,30);
  for(const slice of result.slices.filter(s=>s.key!=="unregistered"))assert.equal(slice.activities.reduce((n,a)=>n+a.minutes,0),slice.minutes);
  const duplicate=partitionTime([{id:"one",title:"공부",category:"study",from:0,until:60},{id:"one",title:"공부",category:"study",from:30,until:90}],date);assert.equal(duplicate.overlap,0);
});
test("야간 활동·쉬는 시간·반복 제외와 종료일을 날짜 경계에 맞춰 분할한다",()=>{
  const s=chartState([chartBlock({start:"23:00",end:"02:00",breakStart:"00:30",breakEnd:"01:00"})]);
  assert.equal(lifestyleCharts(s,date,"day","planned").occupiedMinutes,60);
  const next=lifestyleCharts(s,"2026-10-28","day","planned");assert.equal(next.occupiedMinutes,90);
  const repeating=chartState([chartBlock({kind:"fixed",weekdays:[2,3],until:"2026-10-28",excludedDates:[date]})]);
  assert.equal(lifestyleCharts(repeating,date,"day","planned").occupiedMinutes,0);assert.equal(lifestyleCharts(repeating,"2026-10-28","day","planned").occupiedMinutes,120);assert.equal(lifestyleCharts(repeating,"2026-11-03","day","planned").occupiedMinutes,0);
});
test("예상 부담은 일정 시간 가중 평균이며 겹친 구간의 높은 값만 반영하고 미등록은 0점이 아니다",()=>{
  const spans=[{id:"a",title:"수업",category:"study" as const,from:60,until:180,mental:3,physical:1},{id:"b",title:"운동",category:"exercise" as const,from:120,until:240,mental:5,physical:5}];
  const load=plannedLoad(spans);assert.equal(load.minutes,180);assert.equal(load.mental,13/3);assert.equal(load.physical,11/3);assert.equal(load.highMinutes,120);
  assert.equal(plannedLoad(spans,0,60).mental,null);assert.equal(plannedLoad([],0,1440).physical,null);
  const result=lifestyleCharts(chartState([chartBlock()]),date,"day","planned");assert.equal(result.loadSeries.length,6);assert.equal(result.loadSeries[0].mental,null);assert.equal(result.mental,3);
  assert.equal(lifestyleCharts(chartState([chartBlock()]),date,"week","planned").loadSeries.length,7);
});
test("실제 시간은 확인한 수행 기록만 사용하고 체크·다중 출처·취소 기록으로 늘리지 않는다",()=>{
  const s=chartState([chartBlock()]);s.planner!.records=[{blockId:"study",date,status:"done",title:"강의",start:"09:00",end:"11:00",recordedAt:`${date}T03:00:00Z`}];
  assert.equal(lifestyleCharts(s,date,"day","actual").occupiedMinutes,0);
  const pet=newPetDocument("테스트","charts",new Date(`${date}T00:00:00+09:00`));
  const r:PetExecution={id:"actual",title:"실제 강의",type:"study",start:`${date}T09:30:00+09:00`,end:`${date}T10:30:00+09:00`,intensity:"moderate",sources:[{kind:"planner",id:"study",date},{kind:"routine",id:"linked-routine",date}],cancelled:false,feeling:"same",updatedAt:`${date}T03:00:00Z`,status:"done"};
  pet.records=[r,{...r,id:"cancelled",cancelled:true}];const result=lifestyleCharts(s,date,"day","actual",pet);assert.equal(result.occupiedMinutes,60);assert.equal(result.slices.find(s=>s.key==="study")!.minutes,60);assert.equal(result.slices.find(s=>s.key==="unregistered")!.label,"미기록 시간");assert.equal(result.mental,3);
  r.start=`${date}T23:00:00+09:00`;r.end="2026-10-28T02:00:00+09:00";r.breaks=[{start:"2026-10-28T00:30:00+09:00",end:"2026-10-28T01:00:00+09:00"}];
  assert.equal(actualTimeSpans(s,date,pet).reduce((n,s)=>n+s.until-s.from,0),60);assert.equal(actualTimeSpans(s,"2026-10-28",pet).reduce((n,s)=>n+s.until-s.from,0),90);
});
test("차트에서 카테고리와 실제 활동을 키보드로 선택할 수 있고 부족한 데이터와 계산 기준을 명시한다",()=>{
  const html=renderToStaticMarkup(<LifestyleCharts state={chartState([chartBlock()])} date={date} onDate={()=>{}} onPlan={()=>{}}/>);
  assert.match(html,/분석 기간/);assert.match(html,/계획표 기준/);assert.match(html,/실제 수행 기준/);assert.match(html,/파이차트/);assert.match(html,/tabindex="0"/);assert.match(html,/hsl\(215 60% 54%\)/);assert.match(html,/강의/);assert.match(html,/스트레스·체력 부담 흐름/);assert.match(html,/기본값·출처 미확인/);assert.ok(!html.includes("NaN"));
});
