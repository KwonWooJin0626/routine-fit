import { type AppState,type Checkin,checkinSchema,initialCheckin,localDate } from "./model";
import { plannerDateSchema } from "./planner-model";
import { buildPlannedDay } from "./planner";

// A read-only simulation: never reuse the target day's progress or persist it.
export function buildRoutinePreview(state:AppState,date:string,expected:Checkin=initialCheckin(state.answers),mode:"core"|"full"="core",today=localDate()){
  plannerDateSchema.parse(date);
  const checkin=checkinSchema.parse(expected);
  const history=state.days.filter(d=>d.date<date&&d.date<=today).sort((a,b)=>a.date.localeCompare(b.date));
  const inbody=state.inbody.filter(x=>x.measuredAt<=date&&x.measuredAt<=today).sort((a,b)=>a.measuredAt.localeCompare(b.measuredAt)).at(-1);
  const day=buildPlannedDay(state.answers,checkin,mode,state.schedule,history,inbody,date,true,state.planner);
  const text=(value:string)=>date===today?value:value.replaceAll("오늘","그날");
  return {...day,statuses:{},notes:{},routines:day.routines.map(r=>({...r,title:text(r.title),detail:text(r.detail),reason:text(r.reason),fallback:text(r.fallback),when:text(r.when)})),timeline:day.timeline.map(t=>t.routineId?{...t,title:text(t.title),detail:text(t.detail)}:t),warnings:day.warnings.map(w=>w.replaceAll("오늘","선택한 날짜"))};
}
