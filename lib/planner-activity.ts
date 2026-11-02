import { localDate } from "./model";
import type { Planner,PlannerBlock } from "./planner-model";
import type { PetDocument,PetExecution } from "./pet-model";

export type PlannerActivity={key:string;blockId:string;date:string;title:string;status:"done"|"partial";start:string;end:string;recordedAt:string;block?:PlannerBlock;execution?:PetExecution};

/** Derive the home log from existing records, without creating routines or rewards. */
export function plannerActivitiesForDate(planner:Planner|undefined,pet:PetDocument|null|undefined,date:string):PlannerActivity[]{
  const actual=new Map<string,PetExecution>();
  for(const execution of pet?.records??[])if(!execution.cancelled)for(const source of execution.sources)if(source.kind==="planner")actual.set(`${source.id}:${source.date}`,execution);
  const items=new Map<string,PlannerActivity>();
  for(const record of planner?.records??[]){
    if(record.status!=="done"&&record.status!=="partial")continue;
    const key=`${record.blockId}:${record.date}`,execution=actual.get(key);
    // Confirmed overnight activities appear on the day they actually finished.
    if((execution?localDate(new Date(execution.end)):record.date)!==date)continue;
    items.set(key,{...record,key,status:record.status,block:planner?.blocks.find(b=>b.id===record.blockId),execution});
  }
  // Preserve confirmed history even when a past placement has been removed.
  for(const [key,execution] of actual){
    if(items.has(key)||localDate(new Date(execution.end))!==date)continue;
    const source=execution.sources.find(s=>s.kind==="planner"&&`${s.id}:${s.date}`===key)!;
    const block=planner?.blocks.find(b=>b.id===source.id);
    items.set(key,{key,blockId:source.id,date:source.date,title:execution.title,status:execution.status,start:block?.start??"",end:block?.end??"",recordedAt:execution.updatedAt,block,execution});
  }
  return [...items.values()].sort((a,b)=>(b.execution?.end??b.recordedAt).localeCompare(a.execution?.end??a.recordedAt)||a.key.localeCompare(b.key));
}
