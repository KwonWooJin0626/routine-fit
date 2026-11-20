import { localDate,toMinutes,toTime,type AppState,type Routine } from "./model";
import { addDate,blocksForDate,durationOf,occursOn,plannerConflicts,validatePlannerErrors } from "./planner";
import { plannerSchema,type Planner } from "./planner-model";
import type { MorningFeedback,MorningRecord } from "./morning-model";

export type MorningProposal={id:string;kind:MorningFeedback["kind"];title:string;reason:string;blockId?:string;before?:string;after?:string;end?:string;targetDate?:string;routine?:Routine};
export function morningProposals(state:AppState,row:MorningRecord,now=new Date()):MorningProposal[]{
  const date=row.date;if(date!==localDate(now))return [];
  const tired=row.energy<=2||row.unwell,physical=(row.previousPhysical??0)>=4||(row.highPhysicalMinutes??0)>=90||(row.petStamina!==null&&row.petStamina<=30),mental=(row.previousMental??0)>=4||(row.highMentalMinutes??0)>=90||(row.petStress??0)>=80;
  const proposals:MorningProposal[]=[];
  for(const b of blocksForDate(state.planner,date)){
    if(!tired||b.adjustability!=="adjustable"&&b.adjustability!=="movable"||b.breakStart||toMinutes(b.end)<=toMinutes(b.start))continue;
    if(Date.parse(`${date}T${b.start}:00+09:00`)<=now.getTime()||state.planner?.records?.some(r=>r.blockId===b.id&&r.date===date))continue;
    if(state.activityJournal?.records.some(r=>!r.cancelled&&r.sources.some(s=>s.kind==="planner"&&s.id===b.id&&s.date===date)))continue;
    const protectedTodo=state.planner?.todos?.find(t=>t.id===b.todoId);
    if(protectedTodo?.important||protectedTodo?.dueDate&&protectedTodo.dueDate<=date)continue;
    const focus=["task","growth"].includes(b.category),exercise=b.category==="exercise";
    if(!focus&&!exercise||exercise&&row.unwell)continue;
    if(b.adjustability==="adjustable"&&durationOf(b)>=30){
      const duration=Math.max(15,Math.floor(durationOf(b)/2/5)*5),end=toTime(toMinutes(b.start)+duration);
      proposals.push({id:`short-${b.id}`,kind:exercise?"exercise":"focus",blockId:b.id,title:`${b.title} · 오늘은 ${duration}분`,reason:exercise?"오늘 컨디션에 맞춰 선택한 운동 분량을 줄여봐요.":"선택한 집중 활동의 첫 구간만 진행하고 여유 시간을 확보해봐요.",before:`${date} ${b.start}–${b.end}`,after:`${date} ${b.start}–${end}`,end,targetDate:date});
    }else if(b.adjustability==="movable"){
      const todo=state.planner?.todos?.find(t=>t.id===b.todoId),target=addDate(date,1);
      if(todo?.important||todo?.dueDate&&todo.dueDate<=date||todo?.period&&todo.period.end<target||occursOn(b,target))continue;
      const p:MorningProposal={id:`move-${b.id}`,kind:"move",blockId:b.id,title:`${b.title} · 내일로 옮기기`,reason:"이동 가능으로 설정한 활동이에요. 내일 같은 시간에 겹치는 일정이 있는지 확인해요.",before:`${date} ${b.start}–${b.end}`,after:`${target} ${b.start}–${b.end}`,targetDate:target,end:b.end};
      try{applyMorningProposal(state.planner!,p,date,now);proposals.push(p);}catch{/* No conflicting or protected move is offered. */}
    }
  }
  const recovery=(kind:MorningFeedback["kind"],title:string,detail:string,minutes:number,category:Routine["category"]):MorningProposal=>({id:kind,kind,title,reason:detail,routine:{id:`morning-${date}-${kind}`,title,detail,reason:detail,minutes,category,when:kind==="winddown"?"잠들기 전":"일정 사이",fallback:"1분만 편안하게 쉬어요.",source:"custom"}});
  if(tired&&mental){
    proposals.push(recovery("reading","좋아하는 책 한 문단 읽기","읽고 싶은 책 한 문단을 편안하게 읽으며 잠깐 쉬어봐요.",5,"mind"));
    proposals.push(recovery("video","좋아하는 영상 보며 10분 쉬기","마음 편한 영상 한 편을 고르고 정한 시간이 되면 잠깐 쉬어봐요.",10,"mind"));
  }
  if(tired&&physical||row.unwell)proposals.push(recovery("rest","편안한 자세로 5분 쉬기","지금 편한 자세를 고르고 조용히 쉬는 시간을 가져봐요.",5,"mind"));
  else if(tired)proposals.push(recovery("walk","편안한 속도로 5분 산책","몸이 편안한 날, 가까운 곳을 천천히 걸으며 기분을 전환해봐요.",5,"move"));
  if(tired&&row.sleepHours!==null&&row.sleepHours<7)proposals.push(recovery("winddown","잠들기 전 5분 정리","오늘은 취침 준비 시간을 먼저 확보하고 편안하게 하루를 마무리해봐요.",5,"sleep"));
  if(!proposals.length)proposals.push(recovery("rest","집중 사이 5분 쉬기",row.energy>=4?"컨디션이 좋은 날에도 활동 사이 짧은 여유를 챙겨봐요.":"집중 활동 사이에 편안한 휴식을 넣어봐요.",5,"mind"));
  const feedback=state.morningFeedback??[],day=state.days.find(d=>d.date===date);
  const rank=(p:MorningProposal)=>feedback.filter(f=>f.date<date&&f.kind===p.kind).slice(-30).reduce((n,f)=>n+(f.action==="dismissed"?-1:.5),0)
    +feedback.filter(f=>f.kind===p.kind&&f.routineId&&state.days.some(d=>d.date===f.date&&d.statuses[f.routineId!]==="done")).length*.5;
  const candidates=proposals.filter(p=>!feedback.some(f=>f.date===date&&f.id===p.id)&&!day?.routines.some(r=>r.id===p.routine?.id));
  const priority=(p:MorningProposal)=>Math.max(-1,Math.min(1,rank(p)))+(p.kind==="winddown"?3:p.kind==="rest"&&physical?3:p.kind==="reading"&&mental?2:0);
  candidates.sort((a,b)=>priority(b)-priority(a));
  const schedule=candidates.find(p=>p.blockId),recoveryChoices=candidates.filter(p=>!p.blockId);
  return [...(schedule?[schedule]:[]),...recoveryChoices].slice(0,3);

}

/** Revalidate on apply; change a single occurrence, never the repeating series. */
export function applyMorningProposal(planner:Planner,p:MorningProposal,date:string,now=new Date()):Planner{
  const b=planner.blocks.find(b=>b.id===p.blockId);
  if(!b||date!==localDate(now)||!occursOn(b,date)||!p.targetDate||!p.end)throw new Error("최신 일정에서 제안을 다시 확인해주세요.");
  const move=p.targetDate!==date;
  if(b.adjustability!==(move?"movable":"adjustable")||b.breakStart||!["task","growth","exercise"].includes(b.category)||toMinutes(b.end)<=toMinutes(b.start))throw new Error("이 일정은 자동 조절 대상이 아니에요.");
  if(Date.parse(`${date}T${b.start}:00+09:00`)<=now.getTime()||planner.records?.some(r=>r.blockId===b.id&&r.date===date))throw new Error("이미 시작했거나 기록한 일정은 유지해요.");
  const todo=planner.todos?.find(t=>t.id===b.todoId);
  if(todo?.important||todo?.dueDate&&todo.dueDate<=date)throw new Error("중요한 할 일과 오늘 마감인 일정은 유지해요.");
  if(move&&(p.targetDate!==addDate(date,1)||todo?.important||todo?.dueDate&&todo.dueDate<=date||todo?.period&&todo.period.end<p.targetDate||occursOn(b,p.targetDate)))throw new Error("기한과 반복 일정을 유지해야 해요.");
  if(!move&&(toMinutes(p.end)<=toMinutes(b.start)||toMinutes(p.end)>=toMinutes(b.end)))throw new Error("조절 시간을 다시 확인해주세요.");
  const id=`am-${date}-${b.id}`.slice(0,50);
  if(planner.blocks.some(x=>x.id===id))throw new Error("이미 반영한 제안이에요.");
  const changed={...b,id:b.kind==="once"?b.id:id,kind:"once" as const,date:p.targetDate,end:p.end,weekdays:[],until:undefined,excludedDates:[]};
  const blocks=b.kind==="once"?planner.blocks.map(x=>x.id===b.id?changed:x):[...planner.blocks.map(x=>x.id===b.id?{...x,excludedDates:[...x.excludedDates,date]}:x),changed];
  const next=plannerSchema.parse({...planner,blocks});
  if(move&&plannerConflicts(next,p.targetDate,new Set([changed.id])).length)throw new Error("내일 같은 시간에 다른 일정이 있어요.");
  const errors=validatePlannerErrors(next);if(errors.length)throw new Error(errors[0]);
  return next;
}

export function withMorningFeedback(state:AppState,feedback:MorningFeedback):AppState{
  return {...state,morningFeedback:[...(state.morningFeedback??[]).filter(f=>f.date!==feedback.date||f.id!==feedback.id),feedback].sort((a,b)=>a.at.localeCompare(b.at)).slice(-270)};
}
