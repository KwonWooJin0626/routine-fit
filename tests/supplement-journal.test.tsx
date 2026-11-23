import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultAnswers,defaultSchedule,type AppState } from "../lib/model";
import { emptyNutritionProfile } from "../lib/nutrition-profile";
import { applySupplementCommand,emptySupplementJournal,supplementProductSchema,supplementOccurrences,supplementIngredientQuery,supplementPlannedAt,iherbUrlSchema,type SupplementProduct } from "../lib/supplement-journal";
import { createSupplementHandlers,type SupplementRepository } from "../lib/supplement-api";
import { SupplementChecks,SupplementProductDialog } from "../components/supplement-workspace";
import { lookupSupplementLabel,searchSupplementCatalog } from "../lib/supplement-label";
import { intakeStatus,intakeColumnIncomplete,servingCount,supplementIntake } from "../lib/supplement-intake";
import { parseSupplementPhoto } from "../lib/supplement-label-photo";
import type { SupplementStore } from "../components/use-supplement-journal";
import { updateManualSupplementLabel } from "../lib/supplement-manual-label";
import { SupplementIntakeTable } from "../components/supplement-intake-table";
import { parseDailyLabelUse,labelDefaultDose } from "../lib/supplement-serving";
const date="2026-11-09",now=new Date(`${date}T20:00:00+09:00`);
const app:AppState={version:1,consentAt:now.toISOString(),consentVersion:"2026-10-growth-v1",answers:defaultAnswers,schedule:defaultSchedule,days:[],inbody:[],planner:{setupComplete:true,blocks:[],templates:[]}};
const product=(patch:Partial<SupplementProduct>={})=>supplementProductSchema.parse({id:"vitamin",name:"등록 제품",dose:"1캡슐",startDate:"2026-11-01",weekdays:[0,1,2,3,4,5,6],slots:[{id:"morning",anchor:"fixed",time:"09:00",offset:0}],...patch});
const registered=()=>applySupplementCommand(emptySupplementJournal(),{action:"save",product:product()},app,now);

test("확인한 성분표는 표시량을 기본 적용하고 미표기와 미확인 빈 입력칸을 구분한다",()=>{
  const known=product({id:"known",name:"조회 성공",dose:"",label:{servingSize:1,servingUnit:"정",facts:[{name:"비타민 C",amount:100,unit:"mg",dailyValuePercent:null}]}});
  const unknown=product({id:"unknown",name:"조회 실패",label:undefined});
  const journal={products:[known,unknown],records:[]};
  const result=supplementIntake(journal,app,date,"plan");
  assert.equal(result.rows[0].unconfirmed,false);assert.equal(result.rows[0].doseUnknown,false);assert.equal(result.rows[0].amounts["비타민 C|mg"],100);
  assert.equal(result.rows[1].unconfirmed,true);assert.ok(result.columns.some(c=>c.name==="비타민 A"));
  const html=renderToStaticMarkup(<SupplementIntakeTable journal={journal} app={app} onSaveProduct={async()=>{}} onEditProduct={()=>{}}/>);
  assert.match(html,/<td[^>]*>-<\/td>/);
  assert.match(html,/aria-label="조회 실패 비타민 C mg 직접 입력"[^>]*value=""/);
  assert.doesNotMatch(html,/aria-label="조회 성공 비타민 A/);
});

test("직접 입력은 0과 빈칸을 구분해 저장하고 복용 개수·횟수로 합산하며 과거 성분표를 보존한다",()=>{
  const p=product({label:undefined,dose:"2"});
  const edited=updateManualSupplementLabel(p,{"비타민 C|mg":"100","아연|mg":"0"},"스쿱","2");
  assert.equal(edited.label?.source,"manual");assert.equal(edited.label?.partial,true);
  let journal=applySupplementCommand(emptySupplementJournal(),{action:"save",product:edited},app,now);
  const result=supplementIntake(journal,app,date,"plan");assert.equal(result.totals["비타민 C|mg"],200);assert.equal(result.totals["아연|mg"],0);assert.equal(result.totals["비타민 A|μg RAE"],undefined);
  journal=applySupplementCommand(journal,{action:"record",productId:p.id,date,slotId:p.slots[0].id,status:"taken"},app,now);
  const snapshot=structuredClone(journal.records[0].snapshot);
  const cleared=updateManualSupplementLabel(edited,{"비타민 C|mg":""},"정","1");
  journal=applySupplementCommand(journal,{action:"save",product:cleared},app,now);
  assert.deepEqual(journal.records[0].snapshot,snapshot);assert.equal(journal.products[0].label?.facts.length,1);
  assert.equal(journal.products[0].label?.servingUnit,"스쿱");
  for(const value of ["-1","NaN","Infinity","abc"]){assert.throws(()=>updateManualSupplementLabel(p,{"비타민 C|mg":value},"정","1"));}
  const imported=product({label:{servingSize:1,servingUnit:"정",partial:true,facts:[{name:"비타민 C",amount:100,unit:"mg",dailyValuePercent:null}]}});
  assert.throws(()=>updateManualSupplementLabel(imported,{"비타민 C|mg":"999"},"정","1"));
  assert.equal(updateManualSupplementLabel(imported,{"아연|mg":"10"},"정","1").label?.facts.length,2);
});
test("사진 성분표는 제공량과 단위를 가져오고 확인되지 않은 행을 표시한다",()=>{
  const url="https://kr.iherb.com/pr/example/1234";
  const result=parseSupplementPhoto(`Supplement Facts
Serving Size: 2 Scoops (20 g)
Servings Per Container 30
Amount Per Serving % Daily Value
Magnesium (as citrate) 100 mg 24%
Vitamin D3 25 mcg 125%
Protein 12 g
L-leucine amount unavailable
Other Ingredients: Natural flavor`,url);
  assert.ok(result);
  assert.equal(result.label.productId,"1234");
  assert.equal(result.label.servingUnit,"스쿱");
  assert.equal(result.label.servingSize,2);
  assert.equal(result.label.partial,true);
  assert.equal(result.omitted,1);
  assert.deepEqual(result.label.facts.map(f=>[f.name,f.amount,f.unit]),[
    ["마그네슘",100,"mg"],["비타민 D3",25,"μg"],["Protein",12,"g"],
  ]);
  assert.equal(parseSupplementPhoto("Vitamin D3 25 mcg 125%",url),null);
});
test("1일 섭취표는 제공량을 환산하고 계획과 실제 복용을 구분한다",()=>{
  const url="https://kr.iherb.com/pr/example/137715",label=lookupSupplementLabel(url)!.label;
  const p=product({url,label,dose:"1",slots:[product().slots[0],{id:"evening",anchor:"fixed",time:"19:00",offset:0}]});
  assert.equal(servingCount("2",label),1);
  assert.equal(servingCount("1정",label),0.5);
  assert.equal(servingCount("1스쿱",label),null);
  assert.equal(servingCount("1.5",{...label,servingUnit:"스쿱",servingSize:1}),1.5);
  let journal=applySupplementCommand(emptySupplementJournal(),{action:"save",product:p},app,now);
  journal=applySupplementCommand(journal,{action:"record",productId:p.id,date,slotId:"morning",status:"taken"},app,now);
  journal=applySupplementCommand(journal,{action:"record",productId:p.id,date,slotId:"evening",status:"skipped"},app,now);
  assert.equal(supplementIntake(journal,app,date,"plan").totals["마그네슘|mg"],100);
  assert.equal(supplementIntake(journal,app,date,"actual").totals["마그네슘|mg"],50);
  const manual=product({id:"manual",dose:"1정",label:{servingSize:1,servingUnit:"정",facts:[{name:"마그네슘",amount:30,unit:"mg",dailyValuePercent:null}]}});
  journal=applySupplementCommand(journal,{action:"save",product:manual},app,now);
  assert.equal(supplementIntake(journal,app,date,"plan").totals["마그네슘|mg"],130);
  journal=applySupplementCommand(journal,{action:"save",product:{...p,dose:""}},app,now);
  const planned=supplementIntake(journal,app,date,"plan");
  assert.equal(planned.totals["마그네슘|mg"],230);
  assert.equal(planned.missingCount,0);
  assert.equal(supplementIntake(journal,app,date,"actual").totals["마그네슘|mg"],50);
  assert.equal(intakeStatus({name:"마그네슘",unit:"mg"},30,true).level,"unknown");
  assert.equal(intakeStatus({name:"비타민 D3",unit:"μg"},101,false).level,"high");
});
test("확인된 iHerb 상품의 라벨 25개를 채우고 이름이 같은 다른 상품과 구분한다",()=>{
  const url="https://kr.iherb.com/pr/life-extension-two-per-day-multivitamin-120-tablets/137715?rcode=example";
  const imported=lookupSupplementLabel(url)!;
  assert.equal(imported.label.servingSize,2);
  assert.equal(imported.label.facts.length,25);
  assert.equal(imported.label.facts.find(row=>row.name==="비오틴(B7)")?.unit,"μg");
  const saved=applySupplementCommand(emptySupplementJournal(),{action:"save",product:product({url,label:imported.label})},app,now);
  assert.deepEqual(saved.products[0].label,imported.label);
  assert.match(renderToStaticMarkup(<SupplementProductDialog product={product({url,label:imported.label})} busy={false} onSave={async()=>{}} onClose={()=>{}}/>),/성분표 25개 가져옴/);
  assert.equal(lookupSupplementLabel(url.replace("137715","86454")),null);
  const [goldC]=searchSupplementCatalog("Gold C 1000mg 240캡슐");
  assert.equal(goldC.label.servingUnit,"캡슐");
  assert.equal(goldC.label.facts[0].amount,1000);
  assert.equal(searchSupplementCatalog("Gold C 1000mg 60캡슐").length,0);
  const lutein=lookupSupplementLabel("https://kr.iherb.com/pr/i/95888");
  assert.equal(lutein?.label.servingUnit,"소프트젤");
  assert.deepEqual(searchSupplementCatalog("루테인 제아잔틴 60정")[0].label.facts.map(f=>f.amount),[20,1]);
  assert.equal(lookupSupplementLabel("https://kr.iherb.com/pr/i/94824"),null);
  for(const [id,count] of [["71026",1],["71031",15],["136132",11]] as const){
    const known=lookupSupplementLabel(`https://kr.iherb.com/pr/example/${id}`);
    assert.equal(known?.label.servingUnit,"스쿱");
    assert.equal(known?.label.facts.length,count);
  }
  assert.throws(()=>product({url:url.replace("137715","86454"),label:imported.label}));
});
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

 test("미국 DV 비율은 경계값별 색상을 구분하고 95%를 상한 초과로 판정하지 않는다",()=>{
  for(const [percent,level] of [[0,"verylow"],[49.9,"verylow"],[50,"low"],[69.9,"low"],[70,"within"],[89.9,"within"],[90,"near"],[94.9,"near"],[95,"above"],[100,"above"],[200,"above"]] as const){
    const status=intakeStatus({name:"비타민 C",unit:"mg"},90*percent/100,false);assert.equal(status.level,level,String(percent));assert.ok(Math.abs(status.percent!-percent)<.00001);
  }
  assert.equal(intakeStatus({name:"비타민 C",unit:"mg"},63,true).level,"unknown");
  assert.equal(intakeStatus({name:"비타민 C",unit:"mg"},63,true).percent,70);
  assert.equal(intakeStatus({name:"Lutein",unit:"mg"},20,false).percent,undefined);
  assert.equal(intakeStatus({name:"비타민 D",unit:"μg"},101,false).level,"high");
  assert.equal(intakeStatus({name:"Calcium",unit:"mg"},650,false).percent,50);
 });
 test("하루 안내와 제공량을 구분하고 고정 안내만 기본값으로 적용하며 분할할 수 없는 정제를 나누지 않는다",()=>{
  assert.equal(parseDailyLabelUse("Suggested Usage: Take 1 softgel daily, with food.","소프트젤"),1);
  for(const text of ["Take 1 or 2 softgels daily", "Take 1 softgel twice daily", "Take 1 softgel daily or as directed", "Children: Take 1 softgel daily", "Take 1 softgel daily. Take 2 softgels daily."])assert.equal(parseDailyLabelUse(text,"소프트젤"),undefined);
  const label={servingSize:2,servingUnit:"정" as const,facts:[{name:"비타민 C",amount:90,unit:"mg" as const,dailyValuePercent:null}]};
  assert.equal(labelDefaultDose(label),"2");assert.equal(labelDefaultDose({...label,dailyUnits:1}),"1");
  assert.equal(labelDefaultDose({...label,dailyUnits:1},2),"");assert.equal(labelDefaultDose({...label,dailyUnits:4},2),"2");
  const html=renderToStaticMarkup(<SupplementProductDialog product={product({dose:"",label})} busy={false} onSave={async()=>{}} onClose={()=>{}}/>);
  assert.match(html,/2정 · 시간대당/);assert.match(html,/표시량 변경/);assert.doesNotMatch(html,/계획한 1회 복용량/);
 });

 test("일부 누락 라벨도 확인된 성분의 비율은 표시하고 다른 미확인 제품이 있으면 그 성분의 합계만 보류한다",()=>{
  const column={name:"마그네슘",unit:"mg" as const};
  const p=product({dose:"",label:{servingSize:2,servingUnit:"소프트젤",partial:true,facts:[{name:"마그네슘",amount:250,unit:"mg",dailyValuePercent:null}]}});
  const one=supplementIntake({products:[p],records:[]},app,date,"plan");
  assert.equal(intakeColumnIncomplete(one.rows,column),false);assert.equal(intakeStatus(column,one.totals["마그네슘|mg"],intakeColumnIncomplete(one.rows,column)).level,"low");
  const two=supplementIntake({products:[p,product({id:"unknown",label:undefined})],records:[]},app,date,"plan");assert.equal(intakeColumnIncomplete(two.rows,column),true);
 });
