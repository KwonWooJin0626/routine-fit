import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultAnswers,defaultSchedule,type AppState } from "../lib/model";
import { emptyNutritionProfile } from "../lib/nutrition-profile";
import { applySupplementCommand,emptySupplementJournal,supplementProductSchema,supplementOccurrences,supplementIngredientQuery,supplementPlannedAt,iherbUrlSchema,type SupplementProduct } from "../lib/supplement-journal";
import { createSupplementHandlers,type SupplementRepository } from "../lib/supplement-api";
import { SupplementChecks,SupplementProductDialog } from "../components/supplement-workspace";
import type { SupplementStore } from "../components/use-supplement-journal";
const date="2026-11-09",now=new Date(`${date}T20:00:00+09:00`);
const app:AppState={version:1,consentAt:now.toISOString(),consentVersion:"2026-10-growth-v1",answers:defaultAnswers,schedule:defaultSchedule,days:[],inbody:[],planner:{setupComplete:true,blocks:[],templates:[]}};
const product=(patch:Partial<SupplementProduct>={})=>supplementProductSchema.parse({id:"vitamin",name:"등록 제품",dose:"1캡슐",startDate:"2026-11-01",weekdays:[0,1,2,3,4,5,6],slots:[{id:"morning",anchor:"fixed",time:"09:00",offset:0}],...patch});
const registered=()=>applySupplementCommand(emptySupplementJournal(),{action:"save",product:product()},app,now);
test("제품 입력은 빈 폼으로 열리고 잘못된 주소·반복·시간은 거절한다",()=>{
  assert.match(renderToStaticMarkup(<SupplementProductDialog busy={false} onSave={async()=>{}} onClose={()=>{}}/>),/정확한 제품명/);
  for(const url of ["javascript:alert(1)","https://iherb.com.evil.example/pr/1","https://user@kr.iherb.com/pr/1","http://kr.iherb.com"])assert.equal(iherbUrlSchema.safeParse(url).success,false);
  assert.ok(iherbUrlSchema.safeParse("https://kr.iherb.com/pr/example/1").success);
  assert.throws(()=>product({weekdays:[1,1]}));assert.throws(()=>product({endDate:"2026-10-01"}));
});
test("복용은 같은 날짜·제품·시간에 하나이며 수정·취소가 다른 기록과 앱 상태를 변경하지 않는다",()=>{
  const before=JSON.stringify(app);let j=registered();
  const record={action:"record" as const,productId:"vitamin",date,slotId:"morning",status:"taken" as const};
  j=applySupplementCommand(j,record,app,now);j=applySupplementCommand(j,record,app,now);assert.equal(j.records.length,1);
  const snapshot=structuredClone(j.records[0].snapshot),recordedAt=j.records[0].recordedAt;
  j=applySupplementCommand(j,{action:"save",product:product({name:"수정된 제품",dose:"2캡슐",slots:[{id:"evening",anchor:"fixed",time:"19:00",offset:0}]})},app,now);
  assert.deepEqual(j.records[0].snapshot,snapshot);assert.equal(j.records[0].recordedAt,recordedAt);
  j=applySupplementCommand(j,{action:"archive",productId:"vitamin",active:false},app,now);
  assert.equal(supplementOccurrences(j,date,app).length,1);assert.equal(supplementOccurrences(j,date,app)[0].product.name,"등록 제품");
  j=applySupplementCommand(j,{...record,status:"unknown"},app,now);assert.equal(j.records[0].actualAt,null);assert.equal(j.records[0].dose,"");
  j=applySupplementCommand(j,{action:"clear",recordId:j.records[0].id},app,now);assert.equal(j.records.length,0);assert.equal(JSON.stringify(app),before);
});
test("미래·오래된 기록을 거절하고 과거 복용에는 실제 시각을 받는다",()=>{
  const j=registered(),r={action:"record" as const,productId:"vitamin",slotId:"morning",status:"taken" as const};
  assert.throws(()=>applySupplementCommand(j,{...r,date:"2026-11-10"},app,now));
  assert.throws(()=>applySupplementCommand(j,{...r,date:"2026-07-01"},app,now));
  assert.throws(()=>applySupplementCommand(j,{...r,date:"2026-11-08"},app,now));
  assert.throws(()=>applySupplementCommand(j,{...r,date,actualAt:"2026-11-10T00:00:00Z"},app,now));
  const past=applySupplementCommand(j,{...r,date:"2026-11-08",actualAt:"2026-11-08T00:00:00Z"},app,now);assert.equal(past.records.length,1);
  const skipped=applySupplementCommand(j,{...r,date,status:"skipped"},app,now);assert.equal(skipped.records[0].actualAt,null);
});
test("KST 식사·운동·취침 기준과 자정 이동, 반복 요일을 반영한다",()=>{
  const p=product(),s={id:"night",anchor:"bed" as const,time:"23:30",offset:120};
  const a={...app,schedule:{...defaultSchedule,bed:"23:30",breakfast:"08:00"}};
  assert.equal(supplementPlannedAt(p,s,date,a),"2026-11-09T16:30:00.000Z");
  assert.equal(supplementPlannedAt(p,{...s,anchor:"breakfast",offset:30},date,a),"2026-11-08T23:30:00.000Z");
  assert.equal(supplementOccurrences({products:[product({weekdays:[2]})],records:[]},date,app).length,0);
});
test("저장된 알레르기·유당·식단 정보는 질문 없이 단백질 검색에 반영된다",()=>{
  const a={...app,nutrition:{...emptyNutritionProfile(),allergens:["milk" as const,"soy" as const]}};
  assert.equal(supplementIngredientQuery("protein","whey protein",a),"rice protein");
  assert.equal(supplementIngredientQuery("protein","whey protein",{...app,nutrition:{...emptyNutritionProfile(),lactose:"discomfort"}}),"whey protein isolate lactose free");
});
test("계정 API는 인증·동일출처·충돌·사용자 입력과 서버 오류를 구분한다",async()=>{
  let result={journal:registered(),revision:1};let owner="";
  const repository:SupplementRepository={read:async u=>{owner=u;return result;},mutate:async(u,r,apply)=>{owner=u;if(r!==result.revision)return null;result={journal:apply(result.journal,app),revision:r+1};return result;}};
  const h=createSupplementHandlers(async()=>"account-A",repository,()=>now),anon=createSupplementHandlers(async()=>null,repository,()=>now);
  assert.equal((await anon.GET()).status,401);assert.equal((await h.GET()).headers.get("cache-control"),"private, no-store");assert.equal(owner,"account-A");
  const req=(revision:number,date:string,origin="https://routine.test")=>new Request("https://routine.test/api/supplements",{method:"POST",headers:{origin},body:JSON.stringify({revision,command:{action:"record",productId:"vitamin",date,slotId:"morning",status:"taken"}})});
  assert.equal((await h.POST(req(1,date,"https://evil.test"))).status,403);assert.equal((await h.POST(req(0,date))).status,409);
  assert.equal((await h.POST(req(1,"2026-11-10"))).status,400);assert.equal((await h.POST(req(1,date))).status,200);assert.equal(result.journal.records.length,1);
  const failed=createSupplementHandlers(async()=>"account-A",{...repository,mutate:async()=>{throw Error("database down");}});assert.equal((await failed.POST(req(2,date))).status,503);
});
test("오늘 체크는 미래에 복용을 기록할 수 없고 등록·추천을 복용 완료로 취급하지 않는다",()=>{
  const store={journal:registered(),busy:false,loading:false,error:"",revision:1,reload:async()=>{},mutate:async()=>{},clear:()=>{}} satisfies SupplementStore;
  const html=renderToStaticMarkup(<SupplementChecks app={app} store={store} date="2099-11-09"/>);
  assert.match(html,/미리보기/);assert.match(html,/disabled=""/);assert.match(html,/0\/1/);
});
