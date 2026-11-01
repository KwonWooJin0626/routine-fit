import { type Answers,type Checkin,type Day,type Inbody,type Routine,type Schedule } from "./model";
import { getRoutineCatalog } from "./routine-catalog";
import { buildTimeline } from "./engine";
import { canonicalRoutineId } from "./recommendation-learning";
import { RECOMMENDATION_VERSION,type BehaviorScore,type RecommendationAudit,type RecommendationOptions } from "./recommendation-model";
import { ML_SCHEMA,routineMLFeatures,routineMLSignature } from "./routine-ml";
import { predictRoutineML } from "./routine-ml-inference";

const neutral:BehaviorScore={execution:.5,interest:.5,deletion:.1,observations:0,recentDates:[]};
export function recommendationHash(text:string){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
export function recommendationProbabilities(scores:number[],epsilon=.1,temperature=.08){if(!scores.length)return [];const max=Math.max(...scores),e=scores.map(v=>Math.exp((v-max)/temperature)),sum=e.reduce((a,b)=>a+b,0);return e.map(v=>(1-epsilon)*v/sum+epsilon/scores.length);}
export function recommendationScore(context:number,b:BehaviorScore,repeat=1){return repeat*(.45*context+.4*b.execution+.15*b.interest)*(1-b.deletion)**2;}
export function routineFamily(r:Routine){if(r.activity)return r.activity.domain;if(/reading|read/.test(r.id))return "reading";if(/music/.test(r.id))return "music";if(/focus/.test(r.id))return "study";if(/desk|room/.test(r.id))return "organize";if(/priority|tomorrow|plan|note/.test(r.id))return "planning";if(/reflect|good/.test(r.id))return "reflection";return r.category==="move"?"exercise":r.category==="food"?"food":"rest";}
export function contextForRoutine(r:Routine,a:Answers,c:Checkin){
  const family=routineFamily(r),goal=a.basic?.growthGoal,enabled=a.activities?.profiles.filter(p=>p.enabled)??[];
  const goalScore=r.activity?1:enabled.some(p=>p.domain===family)?.9:goal===family||goal==="recovery"&&family==="rest"?1:["planning","reflection"].includes(family)?.65:.5;
  const low=c.unwell||c.busy||c.energy<=2||c.stress>=4||c.activityMode==="light"||(c.studyMinutes??0)>=240||(c.exerciseMinutes??0)>=60,condition=c.reported===false?.5:low?(family==="rest"?1:r.minutes<=5?.8:.3):.85;
  const target=r.activity?.goalMinutes,time=target?Math.max(0,1-Math.abs(r.minutes-target)/Math.max(target,r.minutes,1)):.5;
  const preferred=a.basic?.focusTime,slot=preferred&&preferred!=="unknown"?.75:.5;
  return .35*goalScore+.3*condition+.2*time+.15*slot;
}
export function selectPersonalizedRoutines(base:Routine[],a:Answers,c:Checkin,history:Day[],inbody:Inbody|undefined,date:string,schedule:Schedule|undefined,omit:Set<string>|undefined,generation:number,options:RecommendationOptions){
  const memory=options.memory,budget=Math.max(0,options.budget??c.minutes),retained=options.retained??[],blocked=new Set([...memory.blocked.map(x=>x.id),...memory.excludedToday]),omitted=new Set([...retained.map(canonicalRoutineId),...[...(omit??[])].map(canonicalRoutineId)]);
  const pool=new Map<string,Routine>();
  for(const r of [...base,...getRoutineCatalog(a,c,inbody)]){
    const id=canonicalRoutineId(r),family=routineFamily(r),cost=r.minutes+(r.activity?.overheadMinutes??0);
    if(omit?.has(r.id)||omitted.has(id)||blocked.has(id)||r.held||cost>budget||cost<0||r.minutes===0&&!r.activity?.linkedEvent)continue;
    if(c.activityMode==="rest")continue;
    if(family==="exercise"&&c.exerciseType==="none")continue;
    if(c.reported!==false&&r.activity?.id==="gym"&&c.place!=="gym")continue;
    if((c.unwell||a.movementLimit||c.activityMode==="light"||c.energy<=2)&&family==="exercise"&&r.activity?.id!=="prepare")continue;
    if((c.unwell||c.busy||c.energy<=2)&&r.minutes>5&&!r.activity)continue;
    if(!pool.has(id))pool.set(id,{...r,source:"auto"});
  }
  const existing=retained.filter(r=>!r.held&&history.find(d=>d.date===date)?.statuses[r.id]!=="done");
  const cost=(r:Routine)=>r.minutes+(r.activity?.overheadMinutes??0);
  const canPlace=(rows:Routine[])=>!schedule||(()=>{const plan=buildTimeline([...existing,...rows],schedule);return rows.every(r=>r.activity?.linkedEvent||plan.timeline.some(t=>t.routineId===r.id));})();
  let remaining=[...pool.values()].filter(r=>canPlace([r])).sort((x,y)=>canonicalRoutineId(x).localeCompare(canonicalRoutineId(y))),counts:Record<string,number>={};
  const minimum=(rows:Routine[],n:number,used:Record<string,number>)=>{if(n===0)return 0;const copy={...used};let sum=0;for(const r of [...rows].sort((x,y)=>cost(x)-cost(y)||x.id.localeCompare(y.id))){const f=routineFamily(r);if((copy[f]??0)>=2)continue;copy[f]=(copy[f]??0)+1;sum+=cost(r);if(--n===0)return sum;}return Infinity;};
  const keptAutomatic=retained.filter(r=>!r.source||r.source==="auto").length,wanted=Math.max(0,memory.count-keptAutomatic);let target=wanted;while(target>0&&minimum(remaining,target,{})>budget)target--;
  const seed=recommendationHash(JSON.stringify([memory.seed,date,generation,a.basic?.growthGoal,a.activities,c,schedule,remaining.map(r=>r.id),memory.count,memory.stats]));let random=seed;
  const rng=()=>{random+=0x6D2B79F5;let t=random;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
  const audit:RecommendationAudit={meta:{batchId:options.learning?.batchId??`rec-${date}-${seed.toString(16)}`,version:RECOMMENDATION_VERSION,date,requested:memory.count,limited:false},context:{date,availableMinutes:budget,generation,seed,memoryRevision:memory.revision},choices:[]};
  const features=(r:Routine)=>{const b=memory.stats[canonicalRoutineId(r)]??neutral,repeat=r.activity?1:1-.1*Math.min(3,b.recentDates.length)/3;return routineMLFeatures(r,a,c,date,budget,b,contextForRoutine(r,a,c),repeat,routineFamily(r),options.learning?.interests??[],options.learning?.generatedAt);};
  if(options.learning){
    audit.learning={schema:ML_SCHEMA,createdAt:options.learning.generatedAt,choices:[]};
    if(options.shadowModel){try{const started=performance.now(),ranked=remaining.map(r=>({id:canonicalRoutineId(r),score:predictRoutineML(options.shadowModel!,features(r))})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));audit.learning.shadow={modelId:options.shadowModel.modelId,topIds:ranked.slice(0,5).map(r=>r.id),elapsedMs:performance.now()-started};}catch{/* Failed experiments never change the rule-based recommendation. */}}
  }
  const chosen:Routine[]=[];let left=budget;
  for(let position=0;position<target;position++){
    const available=remaining.filter(r=>{const f=routineFamily(r);return cost(r)<=left&&(counts[f]??0)<2&&minimum(remaining.filter(x=>x.id!==r.id),target-position-1,{...counts,[f]:(counts[f]??0)+1})<=left-cost(r)&&canPlace([...chosen,r]);});
    if(!available.length)break;
    const parts=available.map(r=>{const b=memory.stats[canonicalRoutineId(r)]??neutral,daily=!!r.activity,repeat=daily?1:1-.1*Math.min(3,b.recentDates.length)/3;return {context:contextForRoutine(r,a,c),execution:b.execution,interest:b.interest,deletion:b.deletion,repeat};});
    const scores=parts.map(p=>recommendationScore(p.context,{execution:p.execution,interest:p.interest,deletion:p.deletion,observations:0,recentDates:[]},p.repeat)),probabilities=recommendationProbabilities(scores),value=rng();let cumulative=0,index=available.length-1;for(let i=0;i<available.length;i++){cumulative+=probabilities[i];if(value<cumulative){index=i;break;}}
    const r=available[index],id=canonicalRoutineId(r),b=memory.stats[id]??neutral;
    const reason=b.observations>=2&&b.execution>.6?"최근 자주 실천한 기록을 반영했어요.":b.interest>.6?"직접 찾아보거나 담았던 관심을 반영했어요.":"오늘의 목표·컨디션과 가능한 시간을 참고했어요.";
    chosen.push({...r,reason:`${r.reason} ${reason}`.slice(0,300)});audit.choices.push({routineId:r.id,canonicalId:id,position,probability:probabilities[index],score:scores[index],parts:parts[index],pool:available.map((x,i)=>({id:canonicalRoutineId(x),score:scores[i],parts:parts[i]}))});
    audit.learning?.choices.push({id,routineId:r.id,definition:routineMLSignature(r),features:features(r),ruleScore:scores[index]});
    const f=routineFamily(r);counts[f]=(counts[f]??0)+1;left-=cost(r);remaining=remaining.filter(x=>canonicalRoutineId(x)!==id);
  }
  audit.meta.limited=chosen.length<wanted;options.onBatch?.(audit);return chosen;
}
