import { z } from "zod";
import { type Day,type Schedule } from "./model";
import { plannerTemplateSchema,plannerSchema,plannerCategories,type Planner } from "./planner-model";
import { scheduleContext,validatePlanner } from "./planner";

// Content edits deliberately preserve each placement's date, time and recurrence.
export const blockContentSchema=plannerTemplateSchema.pick({title:true,category:true,location:true,task:true,mental:true,physical:true,shade:true});
export type BlockContent=z.infer<typeof blockContentSchema>;
export type BlockEditRequest={groupId:string;blockIds:string[];templateIds:string[];content:BlockContent};
export function applyBlockEdit(p:Planner,r:BlockEditRequest):Planner{
  const content=blockContentSchema.parse(r.content);
  if(!r.groupId||r.groupId.length>50)throw new Error("원본 블록 연결 정보를 확인해주세요.");
  const next=plannerSchema.parse({...p,
    blocks:p.blocks.map(b=>r.blockIds.includes(b.id)?{...b,...content,groupId:r.groupId}:b),
    templates:p.templates.map(t=>r.templateIds.includes(t.id)?{...t,...content,groupId:r.groupId}:t)});
  const conflicts=validatePlanner(next);if(conflicts.length)throw new Error(conflicts.join("\n"));
  return next;
}
function savedBlock(id:string,ids:string[]){
  return ids.find(blockId=>{const prefix=`plan-${blockId}-`;return id.startsWith(prefix)&&/^\d{4}-\d{2}-\d{2}(?:-after)?$/.test(id.slice(prefix.length));});
}
// Update linked schedule rows, never replace health routines, notes or progress.
export function editSavedBlockPlans(days:Day[],p:Planner,r:BlockEditRequest,base:Schedule):Day[]{
  return days.map(day=>{
    const affected=day.timeline.some(t=>!t.routineId&&savedBlock(t.id,r.blockIds))||day.planningContext?.importedIds.some(id=>savedBlock(id,r.blockIds));
    if(!affected)return day;
    const timeline=day.timeline.map(t=>{
      const id=!t.routineId?savedBlock(t.id,r.blockIds):undefined,b=p.blocks.find(b=>b.id===id);
      if(!b)return t;
      return {...t,title:b.title,detail:[plannerCategories[b.category],b.location,b.task].filter(Boolean).join(" · ").slice(0,300),kind:b.breakStart?"fixed" as const:b.category==="meal"?"meal" as const:"fixed" as const};
    });
    const context=day.planningContext?scheduleContext(base,p,day.date,day.checkin):undefined;
    return {...day,timeline,planningContext:day.planningContext&&context?{...day.planningContext,mental:context.mental,physical:context.physical,effectiveMinutes:context.effectiveMinutes}:day.planningContext};
  });
}
