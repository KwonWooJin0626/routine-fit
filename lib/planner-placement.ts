import { plannerBlockSchema, plannerSchema, type Planner, type PlannerBlock } from "./planner-model";
import { toMinutes, toTime } from "./model";
import { validatePlannerErrors, weekday } from "./planner";

export type PlacementRange = { date: string; start: string; end: string };

export function changePlannerBlock(planner:Planner,block:PlannerBlock,options:{old?:PlannerBlock;date:string;scope:"date"|"all";groupId:string;keep:boolean;ranges?:PlacementRange[]},newId:()=>string):Planner{
  const {old,date,scope,groupId,keep,ranges}=options;
  block={...block,groupId};
  if(ranges)return placeBlockRanges(planner,block,ranges,groupId,keep,newId);
  let blocks=planner.blocks;
  if(old?.kind==="fixed"&&scope==="date"){
    blocks=blocks.map(b=>b.id===old.id?{...b,groupId,excludedDates:[...new Set([...b.excludedDates,date])]}:b);
    block={...block,id:newId(),kind:"once",date,weekdays:[],until:undefined,excludedDates:[]};blocks=[...blocks,block];
  }else blocks=old?blocks.map(b=>b.id===old.id?block:b):[...blocks,block];
  const {id,kind,date:day,weekdays,until,excludedDates,todoId,...fields}=block;
  const next=plannerSchema.parse({...planner,blocks,templates:keep?[...planner.templates.filter(t=>(t.groupId??t.id)!==groupId),{...fields,id:newId()}]:planner.templates});
  const errors=validatePlannerErrors(next);if(errors.length)throw new Error(errors.join("\n"));return next;
}

/** Build independent weekday schedules together, so a failed range cannot partially save. */
export function placeBlockRanges(planner: Planner, block: PlannerBlock, ranges: PlacementRange[], groupId: string, keep: boolean, newId: () => string): Planner {
  if (!ranges.length) throw new Error("시간대를 하나 이상 선택해주세요.");
  if (ranges.length > 30) throw new Error("한 번에 최대 30개 시간대를 선택할 수 있어요.");
  const blocks = ranges.map(range => {
    const shift = (time: string | undefined) => time ? toTime(toMinutes(range.start) + (toMinutes(time) - toMinutes(block.start) + 1440) % 1440) : undefined;
    const parsed = plannerBlockSchema.safeParse({ ...block, ...range, id: newId(), groupId,
      weekdays: block.kind === "fixed" ? [weekday(range.date)] : [], excludedDates: [],
      breakStart: shift(block.breakStart), breakEnd: shift(block.breakEnd) });
    if (!parsed.success) throw new Error(`${range.date}: ${parsed.error.issues[0].message}`);
    return parsed.data;
  });
  const { id, kind, date, weekdays, until, excludedDates, ...fields } = blocks[0];
  const next = plannerSchema.safeParse({ ...planner, blocks: [...planner.blocks, ...blocks],
    templates: keep ? [...planner.templates.filter(t => (t.groupId ?? t.id) !== groupId), { ...fields, id: newId() }] : planner.templates });
  if (!next.success) throw new Error(next.error.issues[0].message);
  const conflicts = validatePlannerErrors(next.data);
  if (conflicts.length) throw new Error(conflicts.join("\n"));
  return next.data;
}
