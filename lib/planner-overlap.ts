import { activeOccurrenceSpans,occurrencesInWindow,type Occurrence } from "./planner";
import type { Planner } from "./planner-model";

export type CalendarSegment={from:number;until:number;occurrences:Occurrence[]};
const key=(rows:Occurrence[])=>rows.map(o=>`${o.block.id}:${o.date}`).sort().join("|");
/** Exact active membership, split at every start/end/break. No side-by-side lanes. */
export function calendarSegments(p:Planner|undefined,date:string):CalendarSegment[]{
  const rows=occurrencesInWindow(p,date).flatMap(o=>activeOccurrenceSpans(o,date).map(span=>({...span,occurrence:o})));
  const points=[...new Set(rows.flatMap(x=>[x.from,x.until]))].sort((a,b)=>a-b),out:CalendarSegment[]=[];
  for(let i=0;i<points.length-1;i++){
    const from=points[i],until=points[i+1],occurrences=rows.filter(x=>x.from<until&&x.until>from).map(x=>x.occurrence);
    if(!occurrences.length)continue;
    const last=out.at(-1);
    if(last&&last.until===from&&key(last.occurrences)===key(occurrences))last.until=until;
    else out.push({from,until,occurrences});
  }
  return out;
}
