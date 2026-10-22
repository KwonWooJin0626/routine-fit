import test from "node:test";
import assert from "node:assert/strict";
import { defaultAnswers, defaultSchedule, stateSchema, checkinSchema, initialCheckin } from "../lib/model";
import { emptyNutritionProfile, nutritionProfileSchema } from "../lib/nutrition-profile";
import { ingredients, foodOptions, rankIngredients, supplementHolds, proteinDirections } from "../lib/nutrition";
import { guidanceForRoutine } from "../lib/routine-guidance";
import { buildDay } from "../lib/engine";
import { createStateHandlers } from "../lib/state-api";

const a={...defaultAnswers,name:"합성 검증",safetyReviewed:true};
const p={...emptyNutritionProfile(),reviewed:true,allergyStatus:"none" as const,lactose:"comfortable" as const};
const protein=ingredients.find(i=>i.id==="protein")!;
test("기존 계정 데이터는 새 필드 없이도 파싱되고 새 프로필은 저장·복원된다",()=>{
  const old={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-v1",answers:a,schedule:defaultSchedule,inbody:[],days:[]};
  assert.ok(stateSchema.safeParse(old).success);
  const state=stateSchema.parse({...old,answers:{...a,planningStyle:"planned"},nutrition:p});
  assert.deepEqual(stateSchema.parse(JSON.parse(JSON.stringify(state))),state);
});
test("음식정보 미확인·알레르기 모름은 안전으로 간주하지 않는다",()=>{
  assert.ok(supplementHolds(a,emptyNutritionProfile()).length);
  assert.equal(foodOptions(protein,a,emptyNutritionProfile()).length,0);
  assert.equal(supplementHolds(a,p).length,0);
});
test("알레르기 있음은 원료 선택이 필요하고 알려진 원료는 식품에서 제외된다",()=>{
  assert.ok(!nutritionProfileSchema.safeParse({...p,allergyStatus:"known"}).success);
  const q=nutritionProfileSchema.parse({...p,allergyStatus:"known",allergens:["egg","soy","fish"]});
  assert.equal(foodOptions(protein,a,q).length,0);
  assert.ok(supplementHolds(a,q).some(r=>r.includes("알레르기")));
});
test("자유 입력 제한·기타 알레르기·제한 식단은 메뉴를 추측하지 않는다",()=>{
  for(const q of [{...p,avoidFoods:"토마토"},{...p,digestiveNotes:"원인 모를 불편"},{...p,allergyStatus:"known" as const,allergens:["other" as const]}])assert.equal(foodOptions(protein,a,q).length,0);
  assert.equal(foodOptions(protein,{...a,diet:"restricted"},p).length,0);
});
test("우유 알레르기에는 WPC·WPI 제품 방향을 제안하지 않는다",()=>{
  const dirs=proteinDirections(a,{...p,allergyStatus:"known",allergens:["milk"]});
  assert.ok(dirs.every(d=>!d.query));
  assert.ok(dirs[0].detail.includes("WPI도 대안이 아니에요"));
});
test("소화 불편에서는 WPC 제외, WPI를 무유당으로 단정하지 않는다",()=>{
  const dirs=proteinDirections(a,{...p,lactose:"discomfort"});
  assert.ok(!dirs.some(d=>d.title.startsWith("WPC")));
  assert.ok(dirs.some(d=>d.title.startsWith("WPI")&&d.detail.includes("보장하지 않아요")));
});
test("비건·식물성 선택은 유청 방향을 제외하고 단백질 충분 답변은 추가 우선 추천에서 제외한다",()=>{
  assert.ok(proteinDirections({...a,diet:"vegan"},p).every(d=>!d.query.includes("whey")));
  assert.ok(proteinDirections(a,{...p,proteinSource:"plant"}).every(d=>!d.query.includes("whey")));
  assert.ok(!rankIngredients({...a,protein:0},{...p,proteinIntake:"adequate"}).some(r=>r.ingredient.id==="protein"));
});
test("여러 후보에서 최대 5개만 우선 검토하고 낮은 근거 성분을 억지로 채우지 않는다",()=>{
  const rows=rankIngredients({...a,diet:"vegan",protein:0,fish:0,dairy:0,fruit:0,vegetables:0,goal:"fitness",strengthDays:4,legumeDays:0,wholegrainDays:0},p);
  assert.equal(rows.length,5);
  assert.equal(rows[0].ingredient.id,"b12");
  assert.ok(!rows.some(r=>["biotin","b5","milkthistle","bcaa"].includes(r.ingredient.id)));
  assert.equal(rankIngredients({...a,protein:7,fish:7,dairy:7,fruit:7,vegetables:7},p).length,0);
  assert.equal(rankIngredients({...a,supplementOptIn:false},p).length,0);
});
test("질환·복용약·기존 제품·검사 소견은 링크 보류 대상이다",()=>{
  for(const changed of [{medicines:true},{conditions:true},{pregnancy:true},{surgery:true},{currentSupplements:"멀티"},{confirmedDeficiency:"검사 확인"},{safetyReviewed:false}])assert.ok(supplementHolds({...a,...changed},p).length);
});
test("추천 성분·원문 링크는 중복 없고 밀크시슬에 동등 식품을 만들지 않는다",()=>{
  assert.equal(new Set(ingredients.map(i=>i.id)).size,ingredients.length);
  assert.ok(ingredients.every(i=>i.source.startsWith("https://")&&i.role&&i.benefit&&i.limit&&i.caution));
  assert.equal(ingredients.find(i=>i.id==="milkthistle")?.foods.length,0);
});
test("루틴 상세 식품도 저장 프로필을 반영하고 미확인 때 보류한다",()=>{
  const routine={id:"food-protein"};
  assert.equal(guidanceForRoutine(routine,a,null)?.items.length,0);
  const guide=guidanceForRoutine(routine,a,{...p,allergyStatus:"known",allergens:["soy"]});
  assert.ok(!guide?.items.some(i=>i.name.includes("두부")));
});
test("새 체크인은 예상 수면과 실제 수면을 별개로 보존하고 루틴에 반영한다",()=>{
  const c=checkinSchema.parse({...initialCheckin(a),sleep:8,sleepQuality:"poor",sleepOpportunity:4,exerciseType:"strength",exerciseMinutes:60,studyMinutes:240});
  const day=buildDay(a,c,"core",defaultSchedule,[],undefined,"2026-10-22");
  assert.equal(day.checkin.sleep,8);assert.equal(day.checkin.sleepOpportunity,4);
  assert.ok(day.routines.filter(r=>r.category==="move").every(r=>r.minutes<=5));
});
test("계정 저장 API는 새 영양 프로필을 검증하고 그대로 복원한다",async()=>{
  let stored:{payload:string;revision:number}|null=null;
  const h=createStateHandlers(async()=>"synthetic",{get:async()=>stored,save:async(_u,payload)=>{stored={payload,revision:1};return 1;},remove:async()=>{stored=null;}});
  const state={version:1,consentAt:new Date().toISOString(),consentVersion:"2026-10-v1",answers:a,schedule:defaultSchedule,inbody:[],days:[],nutrition:p};
  const response=await h.PUT(new Request("https://test.example/api/state",{method:"PUT",headers:{origin:"https://test.example"},body:JSON.stringify({state,revision:0})}));
  assert.equal(response.status,200);
  const restored=await (await h.GET()).json();assert.deepEqual(restored.state.nutrition,p);
});
