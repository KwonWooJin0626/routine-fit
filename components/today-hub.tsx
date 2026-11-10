"use client";
import { useState,type ReactNode } from "react";
import { ArrowRight,CalendarDays,Check,Plus,Sparkles } from "lucide-react";
import { localDate,type AppState,type Day } from "@/lib/model";
import { occurrencesInWindow } from "@/lib/planner";
import { emptyPlanner,type Planner,type PlannerBlock } from "@/lib/planner-model";
import { toggleTodo,upsertTodo,todosForDate } from "@/lib/planner-todos";
import { plannerSwatch } from "@/lib/planner-colors";
import type { PetResult } from "@/lib/pet-model";
import { PetAnimator } from "./pet-animator";
import { SupplementChecks } from "./supplement-workspace";
import type { SupplementStore } from "./use-supplement-journal";
import { useVisibleMinute } from "./use-visible-minute";
import { FeaturePanel } from "./feature-panel";

export type CheckFilter="all"|"agenda"|"routines"|"care";
type Props={app:AppState;date:string;day?:Day;filter:CheckFilter;onFilter:(f:CheckFilter)=>void;store:SupplementStore;pet:PetResult|null;busy:boolean;onPlan:()=>void;onManage:()=>void;onCheckin:()=>void;onCustom:()=>void;onPet:()=>void;onSavePlanner:(p:Planner)=>Promise<void>;onRecord:(b:PlannerBlock,date:string)=>void;onBasic:()=>void;onChecked:()=>void;onManual:()=>void;checkReaction?:string;children:ReactNode;health:ReactNode;records:ReactNode};

/** Planning and checking share occurrence IDs, never duplicate an activity. */
export function TodayChecks({app,date,day,filter,onFilter,store,pet,busy,onPlan,onManage,onCheckin,onCustom,onPet,onSavePlanner,onRecord,onBasic,onChecked,onManual,checkReaction,children,health,records}:Props){
  const [expanded,setExpanded]=useState(false),[allEvents,setAllEvents]=useState(false),[allTodos,setAllTodos]=useState(false);
  const [title,setTitle]=useState(""),[error,setError]=useState(""),[lastTodo,setLastTodo]=useState<string>();
  const now=useVisibleMinute(),today=localDate(),future=date>today,isToday=date===today,planner=app.planner??emptyPlanner();
  const minute=isToday&&now?(now.getUTCHours()*60+now.getUTCMinutes()+540)%1440:null;
  const events=occurrencesInWindow(planner,date);
  const recorded=(b:PlannerBlock,d:string)=>planner.records?.some(r=>r.blockId===b.id&&r.date===d&&r.status==="done");
  const orderedEvents=events.filter(o=>!recorded(o.block,o.date)).sort((a,b)=>{
    if(minute===null)return a.from-b.from;
    const rank=(o:typeof a)=>o.from<=minute&&o.until>minute?0:o.from>minute?1:2;
    return rank(a)-rank(b)||a.from-b.from;
  });
  const agenda=allEvents?orderedEvents:orderedEvents.slice(0,2);
  const completedTodos=(planner.todos??[]).filter(t=>t.status==="done"&&t.completedAt&&localDate(new Date(t.completedAt))===date);
  const todos=todosForDate(planner,date).filter(t=>t.status!=="done");
  const done=day?.routines.filter(r=>day.statuses[r.id]==="done").length??0,pending=(day?.routines.length??0)-done;
  const saveTodo=async()=>{if(!title.trim()||busy||!isToday)return;try{setError("");await onSavePlanner(upsertTodo(planner,{id:crypto.randomUUID(),title:title.trim(),status:"open",todayDate:date,location:"",notes:"",checklist:[]}));setTitle("");}catch(e){setError((e as Error).message);}};
  const toggle=async(id:string)=>{try{setError("");await onSavePlanner(toggleTodo(planner,id));setLastTodo(id);onChecked();}catch(e){setError((e as Error).message);}};
  return <div className="today-hub">
    <button type="button" className="home-companion panel" onClick={onPet}>
      {pet?.document?.visible!==false&&<PetAnimator baseState={pet?.view?.baseState??"idle"} reducedMotion={pet?.document?.reducedMotion??false} reactionId={checkReaction??pet?.reactionId} name={pet?.document?.name??"새 친구"}/>}
      <span><small>작은 실천으로 함께 성장</small><strong>{checkReaction?"한 가지 해냈어요. 함께 기뻐해요!":`${pet?.document?.name??"나의 사모예드"}와 한 걸음`}</strong><small>선택한 날 · 일정 {events.filter(o=>recorded(o.block,o.date)).length}/{events.length} · 루틴 {done}/{day?.routines.length??0} 완료</small></span><ArrowRight size={18}/>
    </button>
    <div className="check-filters" role="group" aria-label="실천 체크 종류">
      {([["all","전체"],["agenda","일정·할 일"],["routines","루틴"],["care","건강관리"]] as const).map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>onFilter(id)}>{label}</button>)}
    </div>
    {future&&<p className="check-date-notice" role="status">계획 미리보기 · 미래 날짜는 완료나 복용을 기록하지 않아요. <button className="text-link" onClick={onPlan}>이 날짜 계획하기</button></p>}
    {!future&&!isToday&&<p className="check-date-notice" role="status">지난 기록 입력 중 · {date}의 일정과 루틴에 기록해요. 수면은 기존 체크인의 실제 시각을 수정할 수 있어요.</p>}
    <div className="home-agenda-grid" hidden={filter!=="all"&&filter!=="agenda"}>
      <section className="panel home-agenda" aria-label="확인할 일정"><header><h2><CalendarDays size={17}/>{isToday?"지금 · 다음 일정":"이 날짜의 일정"}</h2><button className="text-link" onClick={onPlan}>계획 수정<ArrowRight size={14}/></button></header>
        {agenda.map(o=>{const active=minute!==null&&o.from<=minute&&o.until>minute;return <div className={`home-agenda-row ${active?"is-current":""}`} style={plannerSwatch(o.block.category,o.block.shade,planner.categoryColors)} key={`${o.block.id}-${o.date}`}><button className="routine-check" disabled={busy||future||o.date>today} aria-label={`${o.block.title} 일정 완료`} aria-pressed={false} onClick={()=>onRecord(o.block,o.date)}><span/></button><FeaturePanel title={o.block.title} caption={`${o.block.start}–${o.block.end}${active?" · 진행 중인 예정 일정":""}`}><p>{o.block.location||"등록한 장소가 없어요."}</p><p>{o.block.task||"세부 내용이 없어요."}</p><button className="button secondary" onClick={onPlan}>계획에서 수정</button></FeaturePanel></div>;})}
        {orderedEvents.length>2&&<button className="text-link" aria-expanded={allEvents} onClick={()=>setAllEvents(v=>!v)}>{allEvents?"일정 접기":`일정 ${orderedEvents.length-2}개 더 보기`}</button>}
        {!agenda.length&&<div className="home-empty"><p>{events.length?"이 날짜의 일정을 모두 체크했어요.":"아직 등록된 일정이 없어요."}</p><button className="button secondary" onClick={onPlan}><Plus size={15}/>계획 만들기</button></div>}
      </section>
      <section className="panel home-todos" aria-label="시간 없는 할 일"><header><h2>시간 없는 할 일</h2><small>제목만 적어도 괜찮아요</small></header>
        {(allTodos?todos:todos.slice(0,3)).map(t=><label key={t.id} className="home-todo"><input type="checkbox" disabled={busy||!isToday} checked={false} onChange={()=>void toggle(t.id)}/><span>{t.title}</span></label>)}
        {!todos.length&&<p className="muted">작은 할 일 하나로 시작해요.</p>}
        {todos.length>3&&<button className="text-link" onClick={()=>setAllTodos(v=>!v)}>{allTodos?"접기":`할 일 ${todos.length-3}개 더 보기`}</button>}
        {isToday?<form className="home-todo-add" onSubmit={e=>{e.preventDefault();void saveTodo();}}><input aria-label="할 일 제목" maxLength={60} placeholder="할 일 제목만 입력" value={title} onChange={e=>setTitle(e.target.value)}/><button className="icon-button" disabled={busy||!title.trim()} aria-label="할 일 추가"><Plus size={18}/></button></form>:<p className="muted">할 일 체크는 오늘 실제로 완료한 시각으로 남겨요. 다른 날짜의 배치는 계획에서 관리해요.</p>}
        {lastTodo&&planner.todos?.some(t=>t.id===lastTodo&&t.status==="done")&&<button className="text-link" disabled={busy} onClick={()=>void toggle(lastTodo)}>방금 한 일 체크 되돌리기</button>}{error&&<p className="form-error" role="alert">{error}</p>}
      </section>
    </div>
    <section className="today-check-panel panel" aria-label="선택한 날의 루틴" hidden={filter!=="all"&&filter!=="routines"}><header><h2>{isToday?"오늘의 작은 실천":"이 날짜의 루틴"}</h2>{isToday&&<div><button className="text-link" disabled={busy} onClick={onCheckin}><Sparkles size={14}/>분량 조절</button><button className="text-link" disabled={busy} onClick={onCustom}><Plus size={14}/>직접 추가</button></div>}</header>
      <div className={`today-routine-rows ${expanded?"is-expanded":"is-preview"}`}>{children}{day&&pending===0&&<p className="muted">담아둔 루틴을 모두 체크했어요. 아래 완료 기록에서 확인할 수 있어요.</p>}{pending>3&&<button className="text-link today-show-more" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?"접기":`${pending-3}개 더 보기`}</button>}</div>
      {!day&&isToday&&<button className="text-link" onClick={onBasic}>질문 없이 추천받기</button>}
    </section>
    <section className="panel home-care" hidden={filter!=="all"&&filter!=="care"} aria-label="건강관리 체크"><header><h2>건강관리</h2><button className="text-link" onClick={onManage}>제품·목표 설정</button></header>
      <SupplementChecks store={store} app={app} date={date} compact onManage={onManage}/>
      <div className="check-sleep">{health}</div>
    </section>
    {!future&&<button className="button secondary check-manual" onClick={onManual}><Plus size={16}/>계획에 없던 활동 기록</button>}
    {!future&&<FeaturePanel title="완료한 활동과 기록" caption={`일정 ${events.filter(o=>recorded(o.block,o.date)).length} · 루틴 ${done} · 할 일 ${completedTodos.length}`} emoji="✅">
      {completedTodos.map(t=><div className="home-todo" key={t.id}><Check size={16}/><span>{t.title}</span>{isToday&&<button className="text-link" disabled={busy} onClick={()=>void toggle(t.id)}>되돌리기</button>}</div>)}
      {records}
    </FeaturePanel>}
  </div>;
}
