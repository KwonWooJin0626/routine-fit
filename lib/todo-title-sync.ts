import type { AppState } from "./model";
import type { PetExecution } from "./pet-model";
export function syncTodoRecordTitles(before:AppState,after:AppState,records:PetExecution[]){
 return records.map(record=>{for(const old of before.planner?.todos??[]){const next=after.planner?.todos?.find(t=>t.id===old.id);if(!next||next.title===old.title||record.title!==old.title)continue;
 const linked=record.sources.some(s=>s.kind==="todo"&&s.id===old.id||s.kind==="planner"&&before.planner?.blocks.some(b=>b.id===s.id&&b.todoId===old.id));
 if(linked)return {...record,title:next.title};}return record;});
}
