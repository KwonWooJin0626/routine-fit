import { localDate,toTime,type AppState } from "./model";
import { addDate,mondayOf,occurrencesInWindow,activeOccurrenceSpans } from "./planner";
import type { PlannerBlock } from "./planner-model";
/** A vacant registered interval is a proposal, never confirmed availability. */
export function growthProposal(state:AppState,date:string,now=localDate()):Omit<PlannerBlock,"id">|null{
  const week=addDate(mondayOf(date<now?now:date),7);
  for(let d=0;d<7;d++){
    const day=addDate(week,d),spans=occurrencesInWindow(state.planner,day).flatMap(o=>activeOccurrenceSpans(o,day));
    for(let start=9*60;start+5<=21*60;start+=30){
      if(spans.some(s=>s.from<start+5&&s.until>start))continue;
      return {title:"5분 잠깐 쉬기",category:"rest",kind:"once",date:day,start:toTime(start),end:toTime(start+5),weekdays:[],excludedDates:[],location:"",task:"편한 자세로 짧게 쉬어요.",mental:1,physical:1,mentalSource:"default",physicalSource:"default",shade:1};
    }
  }
  return null;
}
