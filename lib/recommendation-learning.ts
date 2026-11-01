import type { AppState,Routine } from "./model";
import { localDate } from "./model";
import { getRoutineCatalog } from "./routine-catalog";
import { RECOMMENDATION_VERSION,RecommendationError,type RecommendationDocument,type RecommendationEvent,type RecommendationIntent,type RecommendationMemory,type RecommendationRequest,type RecommendationSignal } from "./recommendation-model";

const aliases:Record<string,string>={"activity-reading-read":"growth-reading","activity-study-focus":"growth-focus","mind-read":"growth-reading","mind-focus-read":"growth-reading","mind-priority":"growth-priority","mind-good":"growth-reflect","mind-screen":"growth-pause-screen","sleep-read":"growth-reading-essay","sleep-music":"growth-music-ambient","mind-music":"growth-music-piano"};
export function canonicalRoutineId(r:Pick<Routine,"id"|"activity">|string){const id=typeof r==="string"?r:r.id;return aliases[id]??id;}
const daysApart=(a:string,b:string)=>(Date.parse(`${a}T00:00:00+09:00`)-Date.parse(`${b}T00:00:00+09:00`))/86400000;
export function compactRecommendationDocument(doc:RecommendationDocument,now=new Date()):RecommendationDocument{const today=localDate(now);return {...doc,signals:doc.signals.filter(s=>daysApart(today,s.date)<=89),batches:doc.batches.filter(b=>daysApart(today,b.meta.date)<=89).slice(-180)};}
function signal(doc:RecommendationDocument,r:Routine,date:string){const id=canonicalRoutineId(r);let row=doc.signals.find(s=>s.date===date&&s.canonicalId===id);if(!row){row={date,canonicalId:id,title:r.title,routineIds:[r.id],interestWeight:0};doc.signals.push(row);}if(!row.routineIds.includes(r.id))row.routineIds.push(r.id);row.routineIds=row.routineIds.slice(-20);return row;}
function validRoutine(app:AppState,id:string,date:string){return app.days.find(d=>d.date===date)?.routines.find(r=>r.id===id)??getRoutineCatalog(app.answers,app.days.find(d=>d.date===date)?.checkin??{sleep:7,energy:3,stress:3,minutes:15,unwell:false,place:"home",busy:false},app.inbody.at(-1)).find(r=>r.id===id);}
export function learnRecommendationEvents(doc:RecommendationDocument,app:AppState,events:RecommendationEvent[],now=new Date()){
  const today=localDate(now);
  for(const e of events){
    if(e.date!==today)throw new RecommendationError("오늘 보이는 추천만 기록할 수 있어요.");
    const r=validRoutine(app,e.routineId,e.date);if(!r)throw new RecommendationError("추천 목록을 새로 불러와주세요.",409);
    const day=app.days.find(d=>d.date===e.date);
    if(e.kind==="recommendation_view"&&!day?.routines.some(v=>v.id===r.id&&(!v.source||v.source==="auto")))throw new RecommendationError("현재 자동 추천을 확인해주세요.",409);
    const s=signal(doc,r,e.date);
    if(e.kind==="catalog_view")s.catalogSeen=true;
    if(e.kind==="recommendation_view"){s.recommendationSeen=true;s.censored=!!(day?.checkin.busy||day?.checkin.unwell||day?.checkin.activityMode==="rest"||r.held);}
    if(e.kind==="detail"||e.kind==="search"){s.catalogSeen=true;s.interestWeight=Math.max(s.interestWeight,e.kind==="search"?.4:.1);}
  }
}
export function syncRecommendationState(doc:RecommendationDocument,before:AppState|null,after:AppState,intent?:RecommendationIntent,now=new Date()){
  const today=localDate(now);
  for(const day of after.days.filter(d=>d.date<=today)){
    const groups=new Map<string,Routine[]>();for(const r of day.routines){const id=canonicalRoutineId(r);groups.set(id,[...(groups.get(id)??[]),r]);}
    for(const [id,variants] of groups){
      const priority=(r:Routine)=>({done:3,partial:2,skipped:1}[day.statuses[r.id]]??0);
      const r=[...variants].sort((a,b)=>priority(b)-priority(a))[0],status=day.statuses[r.id];
      const existing=doc.signals.find(s=>s.date===day.date&&s.canonicalId===id);
      if(!existing&&!status&&r.source!=="catalog")continue;
      const s=signal(doc,r,day.date);s.status=status;s.skipReason=day.notes[r.id];s.withdrawn=false;
      if(r.source==="catalog"){s.selected=true;s.catalogSeen=true;s.interestWeight=1;}
    }
    for(const s of doc.signals.filter(s=>s.date===day.date))if(!day.routines.some(r=>canonicalRoutineId(r)===s.canonicalId)&&!s.removed&&s.status!=="done"&&s.status!=="partial")s.withdrawn=true;
  }
  if(!intent)return;
  if(intent.date>today)throw new RecommendationError("미래 날짜의 선호 반응은 저장할 수 없어요.");
  const oldDay=before?.days.find(d=>d.date===intent.date),newDay=after.days.find(d=>d.date===intent.date),old=oldDay?.routines.find(r=>r.id===intent.routineId),next=newDay?.routines.find(r=>r.id===intent.routineId);
  if(intent.kind==="remove"){
    if(!old||next)throw new RecommendationError("삭제한 루틴의 연결을 확인해주세요.",409);
    const s=signal(doc,old,intent.date);s.removed=true;s.withdrawn=false;s.status=oldDay?.statuses[old.id];s.removalReason=s.status==="done"||s.status==="partial"?"cleanup":"generic";
  }else{
    if(!next||old)throw new RecommendationError("추가한 루틴의 연결을 확인해주세요.",409);
    const s=signal(doc,next,intent.date);if(intent.kind==="restore"&&s.removalReason==="never")doc.blocked=doc.blocked.filter(b=>b.id!==s.canonicalId);s.removed=false;s.removalReason=undefined;s.withdrawn=false;
    if(intent.kind==="add"&&next.source==="catalog"){s.selected=true;s.catalogSeen=true;s.interestWeight=1;}
  }
}
export function applyRecommendationRequest(doc:RecommendationDocument,app:AppState,input:RecommendationRequest,now=new Date()){
  if(input.action==="events")learnRecommendationEvents(doc,app,input.events,now);
  if(input.action==="settings")doc.count=input.count as 3|4|5;
  if(input.action==="unblock")doc.blocked=doc.blocked.filter(b=>b.id!==input.canonicalId);
  if(input.action==="exclude"){
    if(input.date!==localDate(now))throw new RecommendationError("오늘 제외한 루틴의 이유만 수정할 수 있어요.");
    const s=doc.signals.find(s=>s.date===input.date&&s.routineIds.includes(input.routineId)&&s.removed);if(!s)throw new RecommendationError("제외 기록을 다시 확인해주세요.",409);
    s.removalReason=input.reason;
    if(input.reason==="never"&&!doc.blocked.some(b=>b.id===s.canonicalId))doc.blocked.push({id:s.canonicalId,title:s.title});
  }
}
export function recommendationMemory(doc:RecommendationDocument,revision=0,now=new Date()):RecommendationMemory{
  const today=localDate(now),groups=new Map<string,RecommendationSignal[]>();
  for(const s of doc.signals){if(s.date>today)continue;groups.set(s.canonicalId,[...(groups.get(s.canonicalId)??[]),s]);}
  const stats:RecommendationMemory["stats"]={};
  for(const [id,rows] of groups){
    let es=0,en=0,is=0,ins=0,ds=0,dn=0;const dates:string[]=[];
    for(const s of rows){
      const age=daysApart(today,s.date),d=2**(-age/30);if(age>89)continue;
      if(s.recommendationSeen&&age<3)dates.push(s.date);
      if(s.interestWeight>0){is+=d*s.interestWeight;ins+=d*s.interestWeight;}else if(s.catalogSeen)ins+=d*.1;
      const reason=s.skipReason,preferenceSkip=reason==="unsuitable",censored=["time","tired","pain","schedule","condition"].includes(reason??"")||s.censored;
      if(s.status==="done"||s.status==="partial"){es+=d*(s.status==="done"?1:.5);en+=d;}
      else if(!s.removed&&!s.withdrawn&&!censored&&!preferenceSkip){
        if(s.status==="skipped")en+=d;
        else if(s.recommendationSeen&&now.getTime()>Date.parse(`${s.date}T00:00:00+09:00`)+36*3600000)en+=d*.1;
      }
      if(s.removed){const r=s.removalReason??"generic",w=r==="generic"?.25:["dislike","never"].includes(r)?1:0;ds+=d*w;dn+=d*w;}
      else if(preferenceSkip){ds+=d;dn+=d;}
      else if(s.recommendationSeen&&!s.withdrawn&&!censored&&age>0)dn+=d;
    }
    stats[id]={execution:(2+es)/(4+en),interest:(1+is)/(2+ins),deletion:(1+ds)/(10+dn),observations:en,recentDates:[...new Set(dates)]};
  }
  return {version:RECOMMENDATION_VERSION,seed:doc.seed,revision,count:doc.count,stats,blocked:doc.blocked,excludedToday:doc.signals.filter(s=>s.date===today&&s.removed).map(s=>s.canonicalId)};
}
