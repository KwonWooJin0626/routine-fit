import { localDate,type AppState } from "./model";
import { plannerTemplateSchema,type PlannerTemplate } from "./planner-model";
import type { PetExecution } from "./pet-model";
import { executionMinutes } from "./pet-execution";

/** A check is a dated fact, not an execution-time estimate or a reward. */
export function changeRoutineCheck(app:AppState,date:string,id:string,value:"done"|"partial"|"skipped",today=localDate()):AppState{
  if(date>today)throw Error("미래 루틴은 미리보기만 가능해요.");
  const day=app.days.find(d=>d.date===date),routine=day?.routines.find(r=>r.id===id);
  if(!day||!routine)throw Error("해당 날짜의 루틴을 찾을 수 없어요.");
  if(routine.held&&day.statuses[id]!==value)throw Error("이 활동은 보류 중이에요. 몸 상태를 다시 확인해주세요.");
  const statuses={...day.statuses};if(statuses[id]===value)delete statuses[id];else statuses[id]=value;
  return {...app,days:app.days.map(d=>d.date===date?{...d,statuses}:d)};
}

/** Reusing an actual activity creates a draft library item, never a new actual record. */
export function activityTemplate(record:PetExecution,id:string):PlannerTemplate{
  const category=({exercise:"exercise",study:"study",work:"work",meal:"meal",growth:"growth",leisure:"growth",rest:"rest",sleep:"rest",social:"social",none:"growth"} as const)[record.type];
  const minutes=Math.max(5,Math.min(720,Math.round(executionMinutes(record)/5)*5));
  const end=9*60+minutes;
  return plannerTemplateSchema.parse({id,title:record.title.slice(0,60),category,petActivity:record.type,start:"09:00",end:`${String(Math.floor(end/60)%24).padStart(2,"0")}:${String(end%60).padStart(2,"0")}`,location:"",task:"",mental:3,physical:2,mentalSource:"unknown",physicalSource:"unknown",shade:1});
}
