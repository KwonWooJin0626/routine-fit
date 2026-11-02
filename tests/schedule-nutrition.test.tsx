import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultAnswers,defaultSchedule,stateSchema,type AppState } from "../lib/model";
import { emptyNutritionProfile,nutritionProfileSchema } from "../lib/nutrition-profile";
import { plannerBlockSchema,type PlannerBlock } from "../lib/planner-model";
import { scheduleNutrition,saveScheduleAnswer } from "../lib/schedule-nutrition";
import { ScheduleNutrition } from "../components/schedule-nutrition";
import { NutritionGuide } from "../components/nutrition-guide";
import { createStateHandlers } from "../lib/state-api";
import { BasicOnboarding } from "../components/basic-onboarding";
import { emptyBasicProfile } from "../lib/basic-profile";

const date="2026-11-02";
const block=(patch:Partial<PlannerBlock>={})=>plannerBlockSchema.parse({id:"exercise",title:"근력 운동",category:"exercise",start:"18:00",end:"19:00",mental:3,physical:3,shade:1,location:"",task:"",kind:"once",date,weekdays:[],...patch});
const state=(blocks:PlannerBlock[]=[]):AppState=>({version:1,consentAt:"2026-11-01T00:00:00Z",consentVersion:"2026-10-growth-v1",answers:{...defaultAnswers,name:"일정 검증"},schedule:{...defaultSchedule,events:[]},inbody:[],days:[],planner:{setupComplete:true,blocks,templates:[]}});
const guide=(s:AppState,id:string,d=date)=>scheduleNutrition(s,d).guides.find(g=>g.id===id);

test("신규 사용자는 닉네임 다음 계획표로 시작하고 추가 기초 설문은 선택이다",()=>{
  const html=renderToStaticMarkup(<BasicOnboarding draft={{answers:{...defaultAnswers,name:"새 사용자",basic:emptyBasicProfile()},step:1}} busy={false} error="" onComplete={()=>{}} onClose={()=>{}}/>);
  assert.match(html,/계획표로 시작/);assert.match(html,/선택 기초 정보도 입력하기/);
  assert.ok(!html.includes("평균 수면시간"));assert.ok(!html.includes("현재 먹고 있는 영양제가 있나요"));
});

test("설문 없이 운동 계획에서 단백질 기능 안내를 만들고 결핍·복용량을 만들지 않는다",()=>{
  const s=state([block()]),g=guide(s,"protein")!;
  assert.ok(g);assert.equal(g.answer,undefined);assert.deepEqual(g.ingredientIds,["protein"]);
  assert.match(g.reason,/예정/);assert.ok(!JSON.stringify(g).includes("mg"));
  assert.equal(s.nutrition,undefined);assert.equal(s.days.length,0);
});
test("다른 카테고리의 운동 단어와 예상 피로도는 영양제로 연결하지 않는다",()=>{
  const s=state([block({category:"study",title:"근력 운동 이론",start:"09:00",end:"15:00",mental:5,physical:5})]);
  const result=scheduleNutrition(s,date);
  assert.ok(!guide(s,"protein"));assert.ok(result.guides.every(g=>!g.ingredientIds.length));
  assert.ok(!guide(state([block({category:"study",title:"수업"})]),"screen"));
});
test("식사 블록 부재는 결식으로 간주하지 않고 바쁜 점심 시간에만 확인한다",()=>{
  assert.ok(!guide(state([block({category:"work",start:"09:00",end:"10:00"})]),"meal"));
  const s=state([block({category:"work",start:"11:00",end:"14:00"})]);
  const g=guide(s,"meal")!;assert.ok(g);assert.match(g.reason,/결식으로 판단하지/);assert.deepEqual(g.ingredientIds,[]);
  s.planner!.blocks.push(block({id:"lunch",category:"meal",start:"12:00",end:"12:30"}));
  assert.ok(!guide(s,"meal"));
});
test("겹친 일정은 시간을 중복 합산하지 않고 등록한 휴식은 제외한다",()=>{
  const s=state([block({start:"11:00",end:"14:00",breakStart:"12:00",breakEnd:"13:30"}),block({id:"overlap",start:"11:00",end:"12:00"})]);
  assert.equal(scheduleNutrition(s,date).exerciseMinutes,90);
  assert.ok(!guide(s,"meal"));
});
test("반복 요일·제외일·종료일·야간 일정·미진행 상태를 반영한다",()=>{
  const b=block({kind:"fixed",date:"2026-10-26",weekdays:[1,3],until:"2026-11-04",excludedDates:[date]});
  const s=state([b]);assert.ok(!guide(s,"protein"));assert.ok(guide(s,"protein","2026-11-04"));assert.ok(!guide(s,"protein","2026-11-09"));
  const overnight=state([block({date:"2026-11-01",start:"23:30",end:"00:30"})]);
  assert.equal(scheduleNutrition(overnight,date).exerciseMinutes,30);
  overnight.planner!.records=[{blockId:"exercise",date:"2026-11-01",title:"근력 운동",start:"23:30",end:"00:30",status:"skipped",recordedAt:"2026-11-01T15:31:00Z"}];
  assert.equal(scheduleNutrition(overnight,date).exerciseMinutes,0);
});
test("모호한 헬스는 종류를 확인하고, 같은 원본의 반복 배치에 재사용한다",()=>{
  const s=state([block({groupId:"gym",title:"헬스"})]);
  assert.ok(!guide(s,"protein"));assert.ok(guide(s,"exercise"));
  s.nutrition={...emptyNutritionProfile(),exerciseModes:[{blockId:"gym",title:"헬스",mode:"strength"}]};
  assert.ok(guide(s,"protein"));
  s.planner!.blocks[0]={...s.planner!.blocks[0],id:"new-placement"};assert.ok(guide(s,"protein"));
  s.planner!.blocks[0].title="수영";assert.ok(guide(s,"hydration"));
  s.planner!.blocks[0].category="study";assert.ok(!guide(s,"protein"));
});
test("가벼운 운동을 포함한 횟수만으로 크레아틴을 보여주지 않는다",()=>{
  const s=state([block(),block({id:"yoga",date:"2026-11-01",title:"요가"})]);
  assert.deepEqual(guide(s,"protein")!.ingredientIds,["protein"]);
  s.planner!.blocks.push(block({id:"prior-strength",date:"2026-10-31"}));
  assert.deepEqual(guide(s,"protein")!.ingredientIds,["protein","creatine"]);
  const cardio=state([block({title:"달리기"}),block({id:"prior-run",date:"2026-11-01",title:"달리기"})]);
  assert.ok(!guide(cardio,"protein")!.ingredientIds.includes("creatine"));
  const night=state([block({date:"2026-11-01",start:"23:30",end:"00:30"})]);
  assert.ok(!guide(night,"protein")!.ingredientIds.includes("creatine"));
});
test("날짜별 한 문항 답변을 저장하고 미확인을 없음이나 안전 확인으로 바꾸지 않는다",()=>{
  const s=state([block()]),g=guide(s,"protein")!;
  s.nutrition=saveScheduleAnswer(emptyNutritionProfile(),date,"protein",g.context,"unknown");
  assert.equal(guide(s,"protein")!.answer,"unknown");assert.match(guide(s,"protein")!.feedback!,/미확인/);
  assert.equal(s.nutrition.reviewed,false);assert.equal(s.nutrition.allergyStatus,"unknown");
  assert.equal(s.nutrition.proteinIntake,"unknown");
  assert.equal(guide(s,"protein","2026-11-03"),undefined);
  s.nutrition=saveScheduleAnswer(s.nutrition,date,"protein",g.context,"difficult");
  assert.equal(s.nutrition.scheduleChecks.length,1);assert.equal(guide(s,"protein")!.answer,"difficult");
});
test("일정이 바뀌면 과거 답변을 자동 적용하지 않고 내용이 같으면 재사용한다",()=>{
  const s=state([block()]),g=guide(s,"protein")!;
  s.nutrition=saveScheduleAnswer(emptyNutritionProfile(),date,"protein",g.context,"possible");
  assert.equal(guide(s,"protein")!.answer,"possible");
  s.planner!.blocks[0].end="20:00";assert.equal(guide(s,"protein")!.answer,undefined);
  s.planner!.blocks[0].end="19:00";assert.equal(guide(s,"protein")!.answer,"possible");
});
test("기존 하루 설정 일정도 분석하고 주간에서 가져온 plan 이벤트는 중복 처리하지 않는다",()=>{
  const s=state();s.schedule.events=[{id:"legacy",title:"달리기",category:"exercise",start:"08:00",end:"09:00"},{id:"plan-imported",title:"근력 운동",category:"exercise",start:"18:00",end:"19:00"}];
  assert.equal(scheduleNutrition(s,date).exerciseMinutes,60);assert.ok(guide(s,"hydration"));
});
test("미동의·빈 일정에서는 영양 후보나 설문을 강제하지 않는다",()=>{
  const s=state([block()]);s.answers.supplementOptIn=false;
  assert.deepEqual(scheduleNutrition(s,date).guides,[]);
  const render=(app:AppState)=>renderToStaticMarkup(<ScheduleNutrition state={app} date={date} busy={false} onSave={async()=>{}}/>);
  assert.equal(render(s),"");assert.match(render(state()),/일정이 아직 없어요/);
});
test("첫 화면은 일정 안내를 먼저 렌더링하고 질문·자료·음식 프로필은 접혀 있다",()=>{
  const s=state([block()]);
  const html=renderToStaticMarkup(<NutritionGuide state={s} initialDate={date} busy={false} onSave={async()=>{}} onEdit={()=>{}}/>);
  assert.ok(html.indexOf("PLAN → NUTRITION")<html.indexOf("음식·섭취 프로필"));
  assert.match(html,/추천 구체화 · 질문 1개/);assert.match(html,/hidden=""/);
  assert.ok(!html.includes('href="https://kr.iherb.com'));
  const compact=renderToStaticMarkup(<ScheduleNutrition compact state={s} date={date} busy={false} onSave={async()=>{}}/>);
  assert.match(compact,/schedule-nutrition-compact/);assert.ok(!compact.includes('<details class="panel schedule-nutrition schedule-nutrition-compact" open'));
});
test("새 선택 답변은 기존 계정 저장 API에서 복원되고 영양 프로필 없는 계정도 파싱된다",async()=>{
  const s=state([block()]),g=guide(s,"protein")!;
  assert.ok(stateSchema.safeParse(s).success);
  s.nutrition=saveScheduleAnswer(emptyNutritionProfile(),date,"protein",g.context,"difficult");
  let row:{payload:string;revision:number}|null=null;
  const h=createStateHandlers(async()=>"synthetic",{get:async()=>row,save:async(_u,payload)=>{row={payload,revision:1};return 1;},remove:async()=>{row=null;}});
  const response=await h.PUT(new Request("https://test.example/api/state",{method:"PUT",headers:{origin:"https://test.example"},body:JSON.stringify({state:s,revision:0})}));
  assert.equal(response.status,200);const restored=(await (await h.GET()).json()).state as AppState;
  assert.equal(guide(restored,"protein")!.answer,"difficult");assert.equal(restored.nutrition!.reviewed,false);
  assert.ok(!nutritionProfileSchema.safeParse({...emptyNutritionProfile(),scheduleChecks:[{date,kind:"protein",context:g.context,answer:"none"}]}).success);
});
