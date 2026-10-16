import { type Day,toMinutes } from "./model";
import { type Planner,type PlannerBlock,type PlannerTemplate } from "./planner-model";
import { addDate,occursOn } from "./planner";
import type { BlockEditRequest } from "./planner-edit";

export type RemovalScope="date"|"future"|"all";
export type RemovalTarget={kind:"block"|"template";item:PlannerBlock|PlannerTemplate;date:string};
export type RemovalRequest={scope:RemovalScope;date:string;blockIds:string[];templateIds:string[];removeLibrary:boolean};
export type PlannerChange={remove?:RemovalRequest;edit?:BlockEditRequest;restorePlans?:Day[]};
export function removalCandidates(p:Planner,target:RemovalTarget){
  const group=target.item.groupId??target.item.id;
  const linked=(item:PlannerBlock|PlannerTemplate)=>item.groupId===group||item.id===group;
  return {linkedBlocks:p.blocks.filter(linked),linkedTemplates:p.templates.filter(linked),
    legacyBlocks:p.blocks.filter(b=>!linked(b)&&!b.groupId&&b.title===target.item.title&&b.category===target.item.category),
    legacyTemplates:p.templates.filter(t=>!linked(t)&&!t.groupId&&t.title===target.item.title&&t.category===target.item.category)};
}
export function upcomingDates(b:PlannerBlock,from:string,count=3){
  if(b.kind==="once")return b.date>=from?[b.date]:[];
  const dates:string[]=[],start=from>b.date?from:b.date;
  for(let n=0;n<(b.excludedDates.length+count+1)*7;n++){const date=addDate(start,n);if(b.until&&date>b.until)break;if(occursOn(b,date))dates.push(date);if(dates.length===count)break;}
  return dates;
}
export function affectedBlock(b:PlannerBlock,r:RemovalRequest){return r.blockIds.includes(b.id)&&(r.scope==="all"||r.scope==="date"&&occursOn(b,r.date)||r.scope==="future"&&upcomingDates(b,r.date,1).length>0);}
export function applyBlockRemoval(p:Planner,r:RemovalRequest):Planner{
  const blocks=p.blocks.flatMap(b=>{
    if(!affectedBlock(b,r))return [b];
    if(r.scope==="all"||b.kind==="once")return [];
    if(r.scope==="date")return [{...b,excludedDates:[...new Set([...b.excludedDates,r.date])]}];
    const until=addDate(r.date,-1);return until<b.date?[]:[{...b,until:b.until&&b.until<until?b.until:until}];
  });
  return {...p,blocks,templates:r.removeLibrary?p.templates.filter(t=>!r.templateIds.includes(t.id)):p.templates};
}
function matchesOccurrence(id:string,r:RemovalRequest){
  for(const blockId of r.blockIds){const prefix=`plan-${blockId}-`;if(!id.startsWith(prefix))continue;const date=id.slice(prefix.length,prefix.length+10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;if(r.scope==="all"||r.scope==="date"&&date===r.date||r.scope==="future"&&date>=r.date)return true;}
  return false;
}
// Remove only linked schedule rows. Health routine progress is never deleted.
export function removeSavedBlockPlans(days:Day[],r:RemovalRequest):Day[]{return days.map(day=>({...day,timeline:day.timeline.filter(t=>!matchesOccurrence(t.id,r)),planningContext:day.planningContext?{...day.planningContext,importedIds:day.planningContext.importedIds.filter(id=>!matchesOccurrence(id,r))}:undefined}));}
export function restoreSavedBlockPlans(days:Day[],snapshots:Day[],wake="07:00"):Day[]{return days.map(day=>{const previous=snapshots.find(d=>d.date===day.date);if(!previous)return day;const absolute=(t:string)=>toMinutes(t)+(toMinutes(t)<toMinutes(wake)?1440:0);return {...day,timeline:[...previous.timeline.filter(t=>!t.routineId),...day.timeline.filter(t=>!!t.routineId)].sort((a,b)=>absolute(a.start)-absolute(b.start)),planningContext:previous.planningContext};});}
