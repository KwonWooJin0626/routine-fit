import type { Answers,AppState,Checkin,Routine } from "./model";
import type { BehaviorScore,RecommendationAudit,RecommendationDocument } from "./recommendation-model";
import { contentInterests,type ContentInterest } from "./media";

export const ML_SCHEMA="routine-completion-v1";
export const ML_FAMILIES=["reading","music","study","planning","reflection","exercise","food","rest","organize","career","language"] as const;
export const ML_FEATURES=["context_score","prior_execution","prior_interest","prior_deletion","prior_observations","repeat_factor","duration_minutes","overhead_minutes","available_minutes","budget_fraction","linked_schedule","planned_style","reported_condition","energy","busy","weekday_sin","weekday_cos","hour_sin","hour_cos",...ML_FAMILIES.map(f=>`family_${f}`),...contentInterests.map(i=>`interest_${i.id}`)];
export type MLObservation={exposedAt:string;position:number;preexisting:boolean;withdrawn:boolean;status?:"done"|"partial"|"skipped";reason?:string;updatedAt:string};
export type MLChoice={id:string;routineId:string;definition:string;features:number[];ruleScore:number;observation?:MLObservation};
export type MLLearning={schema:typeof ML_SCHEMA;createdAt:string;choices:MLChoice[];shadow?:{modelId:string;topIds:string[];elapsedMs:number}};
export function routineMLSignature(r:Routine){
  const a=r.activity,definition=JSON.stringify([r.title,r.detail,r.category,r.minutes,a?[a.domain,a.id,a.goalMinutes,a.overheadMinutes??0,a.linkedEvent??null]:null]);let hash=2166136261;
  for(let i=0;i<definition.length;i++){hash^=definition.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16);
}
export function routineMLFeatures(r:Routine,a:Answers,c:Checkin,date:string,budget:number,b:BehaviorScore,context:number,repeat:number,family:string,interests:ContentInterest[],generatedAt?:string):number[]{
  const weekday=new Date(`${date}T12:00:00+09:00`).getUTCDay();
  const hour=(new Date(generatedAt??`${date}T12:00:00+09:00`).getUTCHours()+9)%24;
  return [context,b.execution,b.interest,b.deletion,Math.min(100,b.observations),repeat,r.minutes,r.activity?.overheadMinutes??0,budget,(r.minutes+(r.activity?.overheadMinutes??0))/Math.max(1,budget),r.activity?.linkedEvent?1:0,a.planningStyle==="planned"?1:0,c.reported===false?0:1,c.reported===false?-1:c.energy,c.busy?1:0,Math.sin(2*Math.PI*weekday/7),Math.cos(2*Math.PI*weekday/7),Math.sin(2*Math.PI*hour/24),Math.cos(2*Math.PI*hour/24),...ML_FAMILIES.map(f=>+(family===f)),...contentInterests.map(i=>+interests.includes(i.id))];
}

/** Only explicit exposure of a server-created batch is eligible for ML. */
export function observeMLRecommendation(batch:RecommendationAudit,app:AppState,id:string,position:number,now:Date){
  const learning=batch.learning,choice=learning?.choices.find(c=>c.id===id);if(!learning||!choice||choice.observation)return;
  const day=app.days.find(d=>d.date===batch.meta.date);
  if(day?.recommendation?.batchId!==batch.meta.batchId)return;
  const routine=day.routines[position];if(!routine||routine.id!==choice.routineId||routineMLSignature(routine)!==choice.definition)return;
  choice.observation={exposedAt:now.toISOString(),position,preexisting:!!day.statuses[routine.id],withdrawn:false,updatedAt:now.toISOString()};
}

/** Rebuild outcomes from current state so undo/reset never leaves stale labels. */
export function syncMLOutcomes(doc:RecommendationDocument,app:AppState,now:Date){
  for(const batch of doc.batches){
    const learning=batch.learning;if(!learning)continue;
    const day=app.days.find(d=>d.date===batch.meta.date);
    for(const choice of learning.choices){
      const obs=choice.observation;if(!obs)continue;
      const active=day?.recommendation?.batchId===batch.meta.batchId;
      const routine=active?day.routines.find(r=>r.id===choice.routineId):undefined;
      const signal=doc.signals.find(s=>s.date===batch.meta.date&&s.canonicalId===choice.id);
      const status=routine?day!.statuses[routine.id]:active&&signal?.removed?signal.status:undefined;
      const reason=routine?day!.notes[routine.id]:signal?.removed?`removed:${signal.removalReason??"generic"}`:undefined;
      const withdrawn=!active||(!routine&&!signal?.removed)||!!routine?.held||!!routine&&routineMLSignature(routine)!==choice.definition||!routine&&obs.withdrawn;
      if(obs.status!==status||obs.reason!==reason||obs.withdrawn!==withdrawn){Object.assign(obs,{status,reason,withdrawn,updatedAt:now.toISOString()});}
    }
  }
}

export type MLRow={group:string;date:string;exposedAt:string;labelAvailableAt:string;candidateId:string;features:number[];label:0|1;ruleScore:number;displayPosition:number;selectionProbability:number};
export function routineTrainingDataset(doc:RecommendationDocument|null,now=new Date()){
  const rows:MLRow[]=[],excluded:Record<string,number>={};let batches=0,exposed=0;
  const drop=(why:string)=>{excluded[why]=(excluded[why]??0)+1;};
  for(const batch of doc?.batches??[]){
    if(batch.learning?.schema!==ML_SCHEMA)continue;batches++;
    for(const c of batch.learning.choices){
      const o=c.observation;if(!o){drop("not_exposed");continue;}exposed++;
      if(o.preexisting){drop("outcome_before_exposure");continue;}
      if(o.withdrawn){drop("superseded_or_withdrawn");continue;}
      if(c.features.length!==ML_FEATURES.length||!c.features.every(Number.isFinite)){drop("invalid_features");continue;}
      const available=Math.max(Date.parse(`${batch.meta.date}T00:00:00+09:00`)+36*3600000,Date.parse(o.updatedAt));
      if(!Number.isFinite(available)||now.getTime()<available){drop("outcome_window_open");continue;}
      let label:0|1;
      if(o.status==="done")label=1;
      else if((o.status==="skipped"&&o.reason==="unsuitable")||["removed:dislike","removed:never"].includes(o.reason??""))label=0;
      else {drop(o.status==="partial"?"partial_separate":o.status||o.reason?"context_or_unspecified_skip":"unknown_outcome");continue;}
      const selection=batch.choices.find(v=>v.canonicalId===c.id);
      if(!selection||!(selection.probability>0&&selection.probability<=1)){drop("missing_selection_audit");continue;}
      rows.push({group:batch.meta.batchId,date:batch.meta.date,exposedAt:o.exposedAt,labelAvailableAt:new Date(available).toISOString(),candidateId:c.id,features:c.features,label,ruleScore:c.ruleScore,displayPosition:o.position,selectionProbability:selection.probability});
    }
  }
  return {schema:ML_SCHEMA,task:"routine_completion",synthetic:false,featureNames:ML_FEATURES,exportedAt:now.toISOString(),rows,summary:{batches,exposed,labeled:rows.length,positive:rows.filter(r=>r.label===1).length,negative:rows.filter(r=>r.label===0).length,groups:new Set(rows.map(r=>r.group)).size,days:new Set(rows.map(r=>r.date)).size,excluded}};
}
