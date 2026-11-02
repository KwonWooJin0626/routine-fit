import type { ExecutionInput } from "./pet-model";

type Timed=Pick<ExecutionInput,"start"|"end"|"breaks">;
/** Absolute intervals preserve overnight dates and exclude recorded breaks. */
export function executionSegments(r:Timed):{start:number;end:number}[]{
  let cursor=Date.parse(r.start);const end=Date.parse(r.end),segments=[];
  for(const pause of [...(r.breaks??[])].sort((a,b)=>a.start.localeCompare(b.start))){
    const from=Date.parse(pause.start),until=Date.parse(pause.end);
    if(cursor<from)segments.push({start:cursor,end:from});cursor=until;
  }
  if(cursor<end)segments.push({start:cursor,end});return segments;
}
export function executionMinutes(r:Timed){return executionSegments(r).reduce((n,s)=>n+(s.end-s.start)/60000,0);}
export function executionsOverlap(a:Timed,b:Timed){return executionSegments(a).some(x=>executionSegments(b).some(y=>x.start<y.end&&x.end>y.start));}
export function validExecutionBreaks(r:Timed){
  let cursor=Date.parse(r.start);const end=Date.parse(r.end);
  for(const pause of [...(r.breaks??[])].sort((a,b)=>a.start.localeCompare(b.start))){
    const from=Date.parse(pause.start),until=Date.parse(pause.end);
    if(!Number.isFinite(from)||!Number.isFinite(until)||from<=cursor||until<=from||until>=end)return false;
    cursor=until;
  }
  return true;
}
