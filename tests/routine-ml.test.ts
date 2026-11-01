import test from "node:test";
import assert from "node:assert/strict";
import { defaultAnswers,defaultSchedule,initialCheckin,type AppState } from "../lib/model";
import { emptyBasicProfile } from "../lib/basic-profile";
import { buildDay } from "../lib/engine";
import { emptyRecommendationDocument,emptyRecommendationMemory,type RecommendationAudit } from "../lib/recommendation-model";
import { applyRecommendationRequest,syncRecommendationState } from "../lib/recommendation-learning";
import { ML_FEATURES,ML_SCHEMA,routineTrainingDataset } from "../lib/routine-ml";
import { validateMLModel,predictRoutineML } from "../lib/routine-ml-inference";
import { createMLTrainingHandler } from "../lib/routine-ml-api";

const date="2026-11-01",now=new Date(`${date}T09:00:00+09:00`),later=new Date("2026-11-03T10:00:00+09:00");
function fixture(){
  const a={...defaultAnswers,name:"합성 학습 계정",basic:emptyBasicProfile()},c={...initialCheckin(a),reported:true,energy:3,minutes:30};let audit:RecommendationAudit|undefined;
  const day=buildDay(a,c,"core",defaultSchedule,[],undefined,date,true,{memory:emptyRecommendationMemory(),learning:{batchId:"rec-fixture",generatedAt:now.toISOString(),interests:["happiness"]},onBatch:b=>audit=b});
  const state:AppState={version:1,consentAt:now.toISOString(),consentVersion:"2026-10-growth-v1",answers:a,schedule:defaultSchedule,inbody:[],days:[day]};
  const doc=emptyRecommendationDocument();doc.batches=[audit!];
  const expose=(index=0)=>applyRecommendationRequest(doc,state,{action:"events",events:[{kind:"recommendation_view",date,routineId:day.routines[index].id,batchId:audit!.meta.batchId,position:index}]},now);
  return {state,doc,day,audit:audit!,expose};
}

test("학습 입력은 추천 당시 숫자로 고정되고 이름·제목·이후 결과를 포함하지 않는다",()=>{
  const {state,doc,audit}=fixture(),features=structuredClone(audit.learning!.choices[0].features);
  assert.equal(features.length,ML_FEATURES.length);assert.ok(features.every(Number.isFinite));assert.equal(features[ML_FEATURES.indexOf("interest_happiness")],1);
  state.answers.name="나중에 바꾼 이름";state.answers.available=120;state.days[0].checkin.energy=1;syncRecommendationState(doc,null,state,undefined,now);
  assert.deepEqual(audit.learning!.choices[0].features,features);assert.ok(!JSON.stringify(audit.learning).includes("나중에 바꾼 이름"));
});
test("노출하지 않은 후보·이전 버전·위조한 위치는 학습 정답으로 만들지 않는다",()=>{
  const f=fixture();f.day.statuses[f.day.routines[0].id]="done";syncRecommendationState(f.doc,null,f.state,undefined,now);assert.equal(routineTrainingDataset(f.doc,later).rows.length,0);
  const g=fixture();applyRecommendationRequest(g.doc,g.state,{action:"events",events:[{kind:"recommendation_view",date,routineId:g.day.routines[0].id,batchId:"forged",position:0},{kind:"recommendation_view",date,routineId:g.day.routines[0].id,batchId:g.audit.meta.batchId,position:1}]},now);assert.equal(g.audit.learning!.choices[0].observation,undefined);
  delete g.audit.learning;assert.equal(routineTrainingDataset(g.doc,later).summary.batches,0);
});
test("정확한 추천 묶음의 실제 노출은 한 번 기록하고 확정 유예 뒤 완료만 양성으로 내보낸다",()=>{
  const f=fixture();f.expose();f.expose();assert.equal(f.audit.learning!.choices.filter(c=>c.observation).length,1);
  f.day.statuses[f.day.routines[0].id]="done";syncRecommendationState(f.doc,null,f.state,undefined,new Date(now.getTime()+1000));
  assert.equal(routineTrainingDataset(f.doc,now).rows.length,0);
  const exported=routineTrainingDataset(f.doc,later);assert.equal(exported.rows.length,1);assert.equal(exported.rows[0].label,1);assert.equal(exported.rows[0].group,"rec-fixture");assert.ok(!JSON.stringify(exported).includes("합성 학습 계정"));
});
test("시간·피로·미입력·부분 수행은 명확한 거절과 구분한다",()=>{
  for(const reason of ["time","tired","pain","schedule","forgot",undefined]){
    const f=fixture();f.expose();f.day.statuses[f.day.routines[0].id]="skipped";if(reason)f.day.notes[f.day.routines[0].id]=reason;syncRecommendationState(f.doc,null,f.state,undefined,now);assert.equal(routineTrainingDataset(f.doc,later).rows.length,0);
  }
  for(const status of [undefined,"partial"] as const){const f=fixture();f.expose();if(status)f.day.statuses[f.day.routines[0].id]=status;syncRecommendationState(f.doc,null,f.state,undefined,now);assert.equal(routineTrainingDataset(f.doc,later).rows.length,0);}
  const f=fixture();f.expose();f.day.statuses[f.day.routines[0].id]="skipped";f.day.notes[f.day.routines[0].id]="unsuitable";syncRecommendationState(f.doc,null,f.state,undefined,now);assert.equal(routineTrainingDataset(f.doc,later).rows[0].label,0);
});
test("완료 취소·추천 교체·완료 전에 이미 있었던 결과를 잘못 학습하지 않는다",()=>{
  const f=fixture();f.expose();f.day.statuses[f.day.routines[0].id]="done";syncRecommendationState(f.doc,null,f.state,undefined,now);delete f.day.statuses[f.day.routines[0].id];syncRecommendationState(f.doc,null,f.state,undefined,now);assert.equal(routineTrainingDataset(f.doc,later).rows.length,0);
  f.day.statuses[f.day.routines[0].id]="done";f.day.recommendation={...f.day.recommendation!,batchId:"new-batch"};syncRecommendationState(f.doc,null,f.state,undefined,now);assert.equal(routineTrainingDataset(f.doc,later).rows.length,0);
  const g=fixture();g.day.statuses[g.day.routines[0].id]="done";g.expose();syncRecommendationState(g.doc,null,g.state,undefined,now);assert.equal(routineTrainingDataset(g.doc,later).summary.excluded.outcome_before_exposure,1);
});
test("싫어함 삭제만 음성이고 완료 후 정리는 완료를 보존하며 되돌리기도 반영한다",()=>{
  const f=fixture();f.expose();const before=structuredClone(f.state),r=f.day.routines[0];f.day.routines=f.day.routines.slice(1);syncRecommendationState(f.doc,before,f.state,{kind:"remove",date,routineId:r.id},now);assert.equal(routineTrainingDataset(f.doc,later).rows.length,0);
  applyRecommendationRequest(f.doc,f.state,{action:"exclude",date,routineId:r.id,reason:"dislike"},now);assert.equal(routineTrainingDataset(f.doc,later).rows[0].label,0);
  const removed=structuredClone(f.state);f.day.routines.unshift(r);syncRecommendationState(f.doc,removed,f.state,{kind:"restore",date,routineId:r.id},now);assert.equal(routineTrainingDataset(f.doc,later).rows.length,0);
  f.day.statuses[r.id]="done";syncRecommendationState(f.doc,null,f.state,undefined,now);const completed=structuredClone(f.state);f.day.routines=f.day.routines.slice(1);syncRecommendationState(f.doc,completed,f.state,{kind:"remove",date,routineId:r.id},now);assert.equal(routineTrainingDataset(f.doc,later).rows[0].label,1);
});
test("사용자가 내용을 바꾼 루틴의 완료를 원래 추천 후보의 성공으로 학습하지 않는다",()=>{
  const f=fixture();f.expose();f.day.routines[0].title="완전히 다른 직접 활동";f.day.statuses[f.day.routines[0].id]="done";syncRecommendationState(f.doc,null,f.state,undefined,now);assert.equal(routineTrainingDataset(f.doc,later).rows.length,0);
  const g=fixture();g.day.routines[0].minutes++;g.expose();assert.equal(g.audit.learning!.choices[0].observation,undefined);
});
test("병행 모델은 실제 추천과 안전·시간 조건을 변경하지 않고 가짜 모델은 운영에서 차단한다",()=>{
  const f=fixture(),raw={schema:ML_SCHEMA,modelId:"unit",featureNames:ML_FEATURES,evaluationOnly:true,trees:[{leaf:1}]};assert.equal(validateMLModel(raw),null);assert.ok(validateMLModel(raw,true));assert.equal(validateMLModel({...raw,evaluationOnly:false,featureNames:["wrong"]}),null);
  const model=validateMLModel({...raw,evaluationOnly:false})!;assert.ok(predictRoutineML(model,f.audit.learning!.choices[0].features)>.5);
  const normal=buildDay(f.state.answers,f.day.checkin,"core",defaultSchedule,[],undefined,date,true,{memory:emptyRecommendationMemory()});let audit:RecommendationAudit|undefined;
  const shadow=buildDay(f.state.answers,f.day.checkin,"core",defaultSchedule,[],undefined,date,true,{memory:emptyRecommendationMemory(),learning:{batchId:"shadow-fixture",generatedAt:now.toISOString(),interests:[]},shadowModel:model,onBatch:b=>audit=b});
  assert.deepEqual(shadow.routines,normal.routines);assert.ok(audit!.learning!.shadow);assert.ok(shadow.routines.reduce((n,r)=>n+r.minutes,0)<=f.day.checkin.minutes);
});
test("학습 현황·내려받기는 세션 계정만 사용하며 잘못된 계정 지정·외부 오류 내용을 차단한다",async()=>{
  const f=fixture();let requested="";const read=async(id:string)=>{requested=id;return f.doc;};
  assert.equal((await createMLTrainingHandler(async()=>null,read)(new Request("https://routine.test/api/recommendations/training"))).status,401);assert.equal(requested,"");
  const handler=createMLTrainingHandler(async()=>"owner",read,()=>later);
  assert.equal((await handler(new Request("https://routine.test/api/recommendations/training?userId=other"))).status,400);
  const response=await handler(new Request("https://routine.test/api/recommendations/training?download=1"));assert.equal(response.status,200);assert.equal(requested,"owner");assert.match(response.headers.get("Content-Disposition")!,/attachment/);assert.equal((await response.json()).schema,ML_SCHEMA);
  const broken=createMLTrainingHandler(async()=>"owner",async()=>{throw Error("database secret");});assert.ok(!(await (await broken(new Request("https://routine.test/api/recommendations/training"))).text()).includes("database secret"));
});
