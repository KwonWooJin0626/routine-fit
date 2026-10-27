import type { AppState } from "./model";
import { addDate, mondayOf, occurrencesInWindow } from "./planner";
import { plannerCategories } from "./planner-model";

export function growthAnalysis(state:AppState,date:string){
  const start=mondayOf(date),dates=Array.from({length:7},(_,i)=>addDate(start,i));
  const rows=dates.map(day=>({date:day,items:occurrencesInWindow(state.planner,day,0,1440)}));
  const coveredDays=rows.filter(r=>r.items.length).length;
  const categories=Object.entries(plannerCategories).map(([key,label])=>({key,label,minutes:rows.reduce((n,r)=>n+r.items.filter(o=>o.block.category===key).reduce((m,o)=>m+o.until-o.from,0),0)})).filter(r=>r.minutes>0);
  const records=(state.planner?.records??[]).filter(r=>dates.includes(r.date));
  const routineDays=state.days.filter(d=>dates.includes(d.date)&&Object.keys(d.statuses).length>0);
  return {start,dates,coveredDays,categories,plannedMinutes:categories.reduce((n,r)=>n+r.minutes,0),unlocked:coveredDays>0,records,done:records.filter(r=>r.status==="done").length,routineDays};
}
