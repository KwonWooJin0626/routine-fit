import type { Planner } from "./planner-model";
import { addDate,mondayOf,occurrencesInWindow } from "./planner";

export type CalendarRow={kind:"slot"|"gap";from:number;until:number;top:number;height:number};
export const SLOT_HEIGHT=24,GAP_HEIGHT=20;
// The same weekly union is used for every column, including the day view.
// Any part of a block keeps its half-hour row; overnight tails count as well.
export function calendarRows(p:Planner|undefined,date:string,compact:boolean):CalendarRow[]{
  const week=mondayOf(date),occupied=Array<boolean>(48).fill(!compact);
  if(compact)for(let d=0;d<7;d++)for(const o of occurrencesInWindow(p,addDate(week,d))){
    for(let i=0;i<48;i++)if(o.from<(i+1)*30&&o.until>i*30)occupied[i]=true;
  }
  const rows:CalendarRow[]=[];let top=0;
  for(let i=0;i<48;){
    if(occupied[i]){rows.push({kind:"slot",from:i*30,until:(i+1)*30,top,height:SLOT_HEIGHT});top+=SLOT_HEIGHT;i++;}
    else {const start=i;while(i<48&&!occupied[i])i++;rows.push({kind:"gap",from:start*30,until:i*30,top,height:GAP_HEIGHT});top+=GAP_HEIGHT;}
  }
  return rows;
}
export function calendarEventRect(rows:CalendarRow[],from:number,until:number){
  const slots=rows.filter(r=>r.kind==="slot"&&r.from<until&&r.until>from);
  if(!slots.length)return null;
  const first=slots[0],last=slots.at(-1)!;
  const start=first.top+(Math.max(first.from,from)-first.from)*SLOT_HEIGHT/30;
  const end=last.top+(Math.min(last.until,until)-last.from)*SLOT_HEIGHT/30;
  // Very short events stay clickable without spilling into an omitted band.
  const height=Math.max(18,end-start),top=Math.min(start,last.top+last.height-height);
  return {top,height};
}
