import { humanDocument } from "./activity-journal";
import type { AppState } from "./model";
import { addDate,mondayOf,occurrencesInWindow,activeOccurrenceSpans } from "./planner";
import { plannerCategories,type PlannerBlock } from "./planner-model";
import { plannerHue } from "./planner-colors";
import { executionSegments } from "./pet-execution";
import type { PetDocument,EffectType } from "./pet-model";

export type ChartPeriod="day"|"week";
export type ChartBasis="planned"|"actual";
export type TimeCategory=PlannerBlock["category"]|"sleep"|"leisure"|"other"|"overlap"|"unregistered";
export type TimeSpan={id:string;title:string;category:TimeCategory;from:number;until:number;mental?:number;physical?:number};
export type TimeActivity={id:string;title:string;minutes:number;dates:string[]};
export type TimeSlice={key:TimeCategory;label:string;color:string;minutes:number;activities:TimeActivity[]};
const categoryKeys=Object.keys(plannerCategories) as PlannerBlock["category"][];
const typeCategory:Record<EffectType,TimeCategory>={study:"study",work:"work",exercise:"exercise",growth:"growth",social:"social",sleep:"sleep",rest:"rest",leisure:"leisure",none:"other",meal:"meal"};
const extraLabels={sleep:"수면",leisure:"여가",other:"기타 활동",overlap:"겹친 시간",unregistered:"미등록 시간"};
export const timeLabel=(minutes:number)=>{const rounded=Math.round(minutes);return rounded>=60?`${Math.floor(rounded/60)}시간${rounded%60?` ${rounded%60}분`:""}`:`${rounded}분`;};
export const timePercent=(minutes:number,total:number)=>`${(total?minutes/total*100:0).toFixed(1)}%`;
export function timeCategoryColor(key:TimeCategory,state:AppState){
  if(categoryKeys.includes(key as PlannerBlock["category"]))return `hsl(${plannerHue(key as PlannerBlock["category"],state.planner?.categoryColors)} 60% 54%)`;
  return {sleep:"#7B74B4",leisure:"#7C9F70",other:"#8392A5",overlap:"#B9404A",unregistered:"#E5EAF0"}[key as keyof typeof extraLabels];
}
export function plannedTimeSpans(state:AppState,date:string):TimeSpan[]{
  return occurrencesInWindow(state.planner,date).flatMap(o=>activeOccurrenceSpans(o,date).map(span=>({...span,id:`${o.block.id}:${o.date}`,title:o.block.title,category:o.block.category,mental:["user","template"].includes(o.block.mentalSource??"")&&["user","template"].includes(o.block.physicalSource??"")?o.block.mental:undefined,physical:["user","template"].includes(o.block.mentalSource??"")&&["user","template"].includes(o.block.physicalSource??"")?o.block.physical:undefined})));
}
export function actualTimeSpans(state:AppState,date:string,pet?:PetDocument|null):TimeSpan[]{
  const start=Date.parse(`${date}T00:00:00+09:00`),end=start+86400000,seen=new Set<string>();
  return humanDocument(state,pet).records.flatMap(record=>{
    if(record.cancelled||seen.has(record.id))return [];seen.add(record.id);
    const linked=[...new Set(record.sources.filter(s=>s.kind==="planner").flatMap(s=>{const b=state.planner?.blocks.find(b=>b.id===s.id);return b?[b.category]:[];}))];
    const category=linked.length===1?linked[0]:typeCategory[record.type];
    return executionSegments(record).flatMap(s=>{const from=Math.max(start,s.start),until=Math.min(end,s.end);return until>from?[{id:record.id,title:record.title,category,from:(from-start)/60000,until:(until-start)/60000}]:[];});
  });
}
/** Partition calendar time, never adding overlapping activities twice. */
export function partitionTime(spans:TimeSpan[],date:string){
  const points=[...new Set([0,1440,...spans.flatMap(s=>[s.from,s.until])])].sort((a,b)=>a-b);
  const totals=new Map<TimeCategory,number>(),activities=new Map<TimeCategory,Map<string,TimeActivity>>();let occupied=0,overlap=0;
  for(let i=0;i<points.length-1;i++){
    const from=points[i],until=points[i+1],minutes=until-from;if(minutes<=0)continue;
    const active=[...new Map(spans.filter(s=>s.from<until&&s.until>from).map(s=>[s.id,s])).values()];
    const category:TimeCategory=!active.length?"unregistered":active.length>1?"overlap":active[0].category;
    totals.set(category,(totals.get(category)??0)+minutes);if(active.length)occupied+=minutes;if(active.length>1)overlap+=minutes;
    if(!active.length)continue;
    const id=active.length>1?[...active].map(s=>`${s.category}:${s.title}`).sort().join("|"):active[0].title;
    const title=active.length>1?active.map(s=>s.title).sort().join(" + "):active[0].title;
    const group=activities.get(category)??new Map<string,TimeActivity>(),old=group.get(id);
    group.set(id,{id,title,minutes:(old?.minutes??0)+minutes,dates:[date]});activities.set(category,group);
  }
  return {totals,activities,occupied,overlap};
}
export function plannedLoad(spans:TimeSpan[],from=0,until=1440){
  const clipped=spans.filter(s=>s.from<until&&s.until>from&&s.mental!==undefined&&s.physical!==undefined),points=[...new Set([from,until,...clipped.flatMap(s=>[Math.max(from,s.from),Math.min(until,s.until)])])].sort((a,b)=>a-b);
  let occupied=0,mentalSum=0,physicalSum=0,highMinutes=0;
  for(let i=0;i<points.length-1;i++){
    const length=points[i+1]-points[i],active=clipped.filter(s=>s.from<points[i+1]&&s.until>points[i]);if(!active.length)continue;
    const mental=Math.max(...active.map(s=>s.mental??1)),physical=Math.max(...active.map(s=>s.physical??1));
    occupied+=length;mentalSum+=mental*length;physicalSum+=physical*length;if(mental>=4||physical>=4)highMinutes+=length;
  }
  return {minutes:occupied,mental:occupied?mentalSum/occupied:null,physical:occupied?physicalSum/occupied:null,highMinutes};
}
export function lifestyleCharts(state:AppState,date:string,period:ChartPeriod,basis:ChartBasis,pet?:PetDocument|null){
  const start=period==="week"?mondayOf(date):date,dates=Array.from({length:period==="week"?7:1},(_,i)=>addDate(start,i)),totalMinutes=dates.length*1440;
  const sums=new Map<TimeCategory,number>(),activitySums=new Map<TimeCategory,Map<string,TimeActivity>>();
  const days=dates.map(day=>{
    const planned=plannedTimeSpans(state,day),spans=basis==="planned"?planned:actualTimeSpans(state,day,pet),partition=partitionTime(spans,day);
    for(const [key,minutes] of partition.totals)sums.set(key,(sums.get(key)??0)+minutes);
    for(const [key,rows] of partition.activities){const group=activitySums.get(key)??new Map<string,TimeActivity>();for(const [id,row] of rows){const old=group.get(id);group.set(id,{...row,minutes:row.minutes+(old?.minutes??0),dates:[...new Set([...(old?.dates??[]),...row.dates])]});}activitySums.set(key,group);}
    return {date:day,occupied:partition.occupied,overlap:partition.overlap,load:plannedLoad(planned),planned};
  });
  const order:TimeCategory[]=[...categoryKeys,"sleep","leisure","other","overlap","unregistered"];
  const slices:TimeSlice[]=order.filter(key=>(sums.get(key)??0)>0).map(key=>({key,label:key==="unregistered"&&basis==="actual"?"미기록 시간":plannerCategories[key as keyof typeof plannerCategories]??extraLabels[key as keyof typeof extraLabels],color:timeCategoryColor(key,state),minutes:sums.get(key)!,activities:[...(activitySums.get(key)?.values()??[])].sort((a,b)=>b.minutes-a.minutes)}));
  const loadSeries=period==="week"?days.map(d=>({label:new Intl.DateTimeFormat("ko-KR",{weekday:"short",timeZone:"Asia/Seoul"}).format(new Date(`${d.date}T12:00:00+09:00`)),detail:d.date,...d.load})):Array.from({length:6},(_,i)=>({label:`${String(i*4).padStart(2,"0")}–${String((i+1)*4).padStart(2,"0")}시`,detail:`${date} ${i*4}–${(i+1)*4}시`,...plannedLoad(days[0].planned,i*240,(i+1)*240)}));
  const loadMinutes=days.reduce((n,d)=>n+d.load.minutes,0),mental=loadMinutes?days.reduce((n,d)=>n+(d.load.mental??0)*d.load.minutes,0)/loadMinutes:null,physical=loadMinutes?days.reduce((n,d)=>n+(d.load.physical??0)*d.load.minutes,0)/loadMinutes:null;
  return {start,end:dates[dates.length-1],dates,totalMinutes,slices,days,loadSeries,mental,physical,loadMinutes,highMinutes:days.reduce((n,d)=>n+d.load.highMinutes,0),occupiedMinutes:days.reduce((n,d)=>n+d.occupied,0),overlapMinutes:days.reduce((n,d)=>n+d.overlap,0),coveredDays:days.filter(d=>d.occupied>0).length};
}
