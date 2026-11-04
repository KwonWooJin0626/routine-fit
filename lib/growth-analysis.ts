import type { AppState } from "./model";
import { addDate, mondayOf, occurrencesInWindow,activeOccurrenceSpans } from "./planner";
import { plannerCategories } from "./planner-model";

export function growthAnalysis(state:AppState,date:string){
  const start=mondayOf(date),dates=Array.from({length:7},(_,i)=>addDate(start,i));
  const rows=dates.map(day=>({date:day,items:occurrencesInWindow(state.planner,day,0,1440)}));
  const coveredDays=rows.filter(r=>r.items.length).length;
  const union=(spans:{from:number;until:number}[])=>{let minutes=0,end=-Infinity;for(const s of [...spans].sort((a,b)=>a.from-b.from)){minutes+=Math.max(0,s.until-Math.max(end,s.from));end=Math.max(end,s.until);}return minutes;};
  const categories=Object.entries(plannerCategories).map(([key,label])=>({key,label,minutes:rows.reduce((n,r)=>n+union(r.items.filter(o=>o.block.category===key).flatMap(o=>activeOccurrenceSpans(o,r.date))),0)})).filter(r=>r.minutes>0);
  const plannedMinutes=rows.reduce((n,r)=>n+union(r.items.flatMap(o=>activeOccurrenceSpans(o,r.date))),0);
  const records=(state.planner?.records??[]).filter(r=>dates.includes(r.date));
  const routineDays=state.days.filter(d=>dates.includes(d.date)&&Object.keys(d.statuses).length>0);
  return {start,dates,coveredDays,categories,plannedMinutes,unlocked:coveredDays>0,records,done:records.filter(r=>r.status==="done").length,routineDays};
}
