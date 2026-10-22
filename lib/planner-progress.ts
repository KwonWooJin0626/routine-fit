import type { Planner, PlannerBlock } from "./planner-model";
import { occursOn } from "./planner";
import { localDate } from "./model";

export function recordOccurrence(planner:Planner,block:PlannerBlock,date:string,status:"done"|"partial"|"skipped",today=localDate()):Planner {
  if(date>today)throw new Error("미래 일정은 완료 처리할 수 없어요.");
  if(!planner.blocks.some(b=>b.id===block.id)&&!(planner.records??[]).some(r=>r.blockId===block.id&&r.date===date))throw new Error("일정을 찾을 수 없어요.");
  if(!occursOn(block,date))throw new Error("해당 날짜에 없는 일정이에요.");
  const old=planner.records?.find(r=>r.blockId===block.id&&r.date===date);
  const records=(planner.records??[]).filter(r=>r.blockId!==block.id||r.date!==date);
  if(old?.status!==status)records.push({blockId:block.id,date,status,title:old?.title??block.title,start:old?.start??block.start,end:old?.end??block.end,recordedAt:new Date().toISOString()});
  return {...planner,records:records.sort((a,b)=>a.date.localeCompare(b.date)).slice(-1000)};
}
