import { type Answers,type Checkin,type Day,type Inbody,type Schedule,localDate,toMinutes,toTime } from "./model";
import { type Planner,type PlannerBlock,plannerCategories } from "./planner-model";
import { buildDay,reviseDayRoutines } from "./engine";
import { conditionSummary } from "./routine-catalog";

export const weekdayNames=["일","월","화","수","목","금","토"];
export function addDate(date:string,n:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function weekday(date:string){return new Date(`${date}T12:00:00Z`).getUTCDay();}
export function mondayOf(date:string){return addDate(date,-((weekday(date)+6)%7));}
export function occursOn(b:PlannerBlock,date:string){return b.kind==="once"?b.date===date:date>=b.date&&(!b.until||date<=b.until)&&b.weekdays.includes(weekday(date))&&!b.excludedDates.includes(date);}
export function blocksForDate(p:Planner|undefined,date:string){return (p?.blocks??[]).filter(b=>occursOn(b,date)).sort((a,b)=>toMinutes(a.start)-toMinutes(b.start));}
export function durationOf(b:Pick<PlannerBlock,"start"|"end">){return (toMinutes(b.end)-toMinutes(b.start)+1440)%1440;}
export type Occurrence={block:PlannerBlock;date:string;from:number;until:number};
// Intersect real calendar occurrences with a requested time window. This also
// brings in the preceding night's tail and the next day's early-morning work.
export function occurrencesInWindow(p:Planner|undefined,date:string,from=0,until=1440):Occurrence[]{
  const rows:Occurrence[]=[];
  for(const offset of [-1,0,1])for(const block of blocksForDate(p,addDate(date,offset))){const start=offset*1440+toMinutes(block.start),end=start+durationOf(block);if(start<until&&end>from)rows.push({block,date:addDate(date,offset),from:Math.max(from,start),until:Math.min(until,end)});}
  return rows.sort((a,b)=>a.from-b.from);
}
export function plannerConflicts(p:Planner,date:string):string[]{
  const rows=occurrencesInWindow(p,date),errors:string[]=[];
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(rows[i].from<rows[j].until&&rows[j].from<rows[i].until){
    const a=rows[i],b=rows[j];
    // A block explicitly allows its own break to be used by a meal/appointment.
    const insideBreak=(outer:Occurrence,inner:Occurrence)=>{const x=outer.block;if(!x.breakStart||!x.breakEnd)return false;const shift=Math.round((new Date(`${outer.date}T12:00Z`).getTime()-new Date(`${date}T12:00Z`).getTime())/86400000)*1440;const start=shift+toMinutes(x.start),pause=start+(toMinutes(x.breakStart)-toMinutes(x.start)+1440)%1440,end=start+(toMinutes(x.breakEnd)-toMinutes(x.start)+1440)%1440;return inner.from>=pause&&inner.until<=end;};
    if(!insideBreak(a,b)&&!insideBreak(b,a))errors.push(`${date}: “${a.block.title}”와 “${b.block.title}”의 시간이 겹쳐요.`);
  }
  if(rows.length>30)errors.push(`${date}: 하루 블록은 최대 30개까지 배치해주세요.`);
  return [...new Set(errors)];
}
export function validatePlanner(p:Planner){
  const dates=new Set<string>();
  // All recurrence boundaries plus one whole week cover weekday intersections;
  // every one-off date and overnight tail is checked separately.
  for(const b of p.blocks){for(let n=-1;n<=7;n++)dates.add(addDate(b.date,n));if(b.until){dates.add(b.until);dates.add(addDate(b.until,1));}}
  for(const a of p.blocks)for(const b of p.blocks)if(a.kind==="fixed"&&b.kind==="fixed"){const start=a.date>b.date?a.date:b.date;for(let n=0;n<7;n++)dates.add(addDate(start,n));}
  return [...dates].sort().flatMap(d=>plannerConflicts(p,d)).slice(0,8);
}
export function scheduleForDate(base:Schedule,p:Planner|undefined,date:string):Schedule{
  if(!p?.blocks.length)return base;
  const wake=toMinutes(base.wake),bed=toMinutes(base.bed)+(toMinutes(base.bed)<=wake?1440:0);
  const events=occurrencesInWindow(p,date,wake,bed).map(o=>{
    const b=o.block,detail=[plannerCategories[b.category],b.location,b.task].filter(Boolean).join(" · ");
    const start=toMinutes(b.start),offset=Math.round((new Date(`${o.date}T12:00Z`).getTime()-new Date(`${date}T12:00Z`).getTime())/86400000)*1440;
    const pause=b.breakStart?offset+start+(toMinutes(b.breakStart)-start+1440)%1440:undefined;
    const pauseEnd=b.breakEnd?offset+start+(toMinutes(b.breakEnd)-start+1440)%1440:undefined;
    return {id:`plan-${b.id}-${o.date}`,title:b.title,start:toTime(o.from),end:toTime(o.until),category:b.category,description:detail.slice(0,300),...(pause!==undefined&&pauseEnd!==undefined&&pause>o.from&&pauseEnd<o.until?{breakStart:toTime(pause),breakEnd:toTime(pauseEnd)}:{})};
  });
  return {...base,events:[...base.events.filter(e=>!e.id.startsWith("plan-")),...events]};
}
export function scheduleContext(base:Schedule,p:Planner|undefined,date:string,c:Checkin){
  const wake=toMinutes(base.wake),bed=toMinutes(base.bed)+(toMinutes(base.bed)<=wake?1440:0),rows=occurrencesInWindow(p,date,wake,bed);
  const weight=(o:Occurrence)=>{const b=o.block;if(!b.breakStart||!b.breakEnd)return o.until-o.from;const offset=Math.round((new Date(`${o.date}T12:00Z`).getTime()-new Date(`${date}T12:00Z`).getTime())/86400000)*1440,start=offset+toMinutes(b.start);const pause=start+(toMinutes(b.breakStart)-toMinutes(b.start)+1440)%1440,end=start+(toMinutes(b.breakEnd)-toMinutes(b.start)+1440)%1440;return o.until-o.from-Math.max(0,Math.min(o.until,end)-Math.max(o.from,pause));};
  const minutes=rows.reduce((n,o)=>n+weight(o),0);
  const mental=minutes?rows.reduce((n,o)=>n+weight(o)*o.block.mental,0)/minutes:1;
  const physical=minutes?rows.reduce((n,o)=>n+weight(o)*o.block.physical,0)/minutes:1;
  const s=scheduleForDate(base,p,date),intervals=s.events.flatMap(e=>{const start=toMinutes(e.start)+(toMinutes(e.start)<wake?1440:0),end=start+(toMinutes(e.end)-toMinutes(e.start)+1440)%1440;return e.breakStart&&e.breakEnd?[{from:start,until:start+(toMinutes(e.breakStart)-toMinutes(e.start)+1440)%1440},{from:start+(toMinutes(e.breakEnd)-toMinutes(e.start)+1440)%1440,until:end}]:[{from:start,until:end}];}).sort((a,b)=>a.from-b.from);
  let occupied=0,last=wake;for(const x of intervals){const from=Math.max(wake,x.from,last),until=Math.min(bed,x.until);if(until>from)occupied+=until-from;last=Math.max(last,until);}
  const free=Math.max(0,bed-wake-occupied-base.preparation-(s.events.length?base.commute*2:0)-60);
  const effectiveMinutes=Math.min(c.minutes,free,physical>=4||mental>=4?10:60);
  return {date,scheduledMinutes:Math.min(1440,occupied),mental:Math.round(mental*10)/10,physical:Math.round(physical*10)/10,effectiveMinutes,importedIds:rows.map(o=>`plan-${o.block.id}-${o.date}`)};
}
export function buildPlannedDay(a:Answers,c:Checkin,mode:"core"|"full",base:Schedule,history:Day[]=[],inbody?:Inbody,date=localDate(),refresh=true,p?:Planner):Day{
  if(!p?.blocks.length)return buildDay(a,c,mode,base,history,inbody,date,refresh);
  const context=scheduleContext(base,p,date,c),s=scheduleForDate(base,p,date);
  const adjusted={...c,minutes:Math.max(5,context.effectiveMinutes),busy:c.busy||context.scheduledMinutes>=480||context.effectiveMinutes<10,energy:context.physical>=4?Math.min(c.energy,2):c.energy,stress:context.mental>=4?Math.max(c.stress,4):c.stress};
  let day=buildDay(a,adjusted,mode,s,history,inbody,date,refresh);
  // Do not discard a user's blocks or progress to force-fit a new recommendation.
  const prior=history.find(d=>d.date===date),protectedIds=new Set(prior?.routines.filter(r=>r.source==="custom"||r.source==="catalog"||prior.statuses[r.id]).map(r=>r.id));
  let remaining=context.effectiveMinutes;
  const routines=day.routines.filter(r=>{if(protectedIds.has(r.id)){if(!r.held&&day.statuses[r.id]!=="done")remaining-=r.minutes;return true;}if(!refresh&&prior)return true;if(r.minutes>remaining)return false;remaining-=r.minutes;return true;}).map(r=>protectedIds.has(r.id)?r:{...r,reason:`${r.reason.split(conditionSummary(adjusted)).join(conditionSummary(c))} 일정의 예상 부담·피로도를 참고해 분량을 조정했어요.`.slice(0,300)});
  day=reviseDayRoutines({...day,checkin:c,planningContext:context},routines,s);
  if(remaining<0)day.warnings.push("유지한 루틴이 일정 사이의 여유시간보다 많아요. 직접 담은 루틴과 실천 기록은 보존했으니 가능한 만큼 조정해주세요.");
  if(!routines.length)day.warnings.push("오늘 일정에 여유가 부족해 새로운 건강 루틴을 추가하지 않았어요. 식사·휴식 시간을 먼저 확보해주세요.");
  return day;
}
