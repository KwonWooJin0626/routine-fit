"use client";
import { useState,type ReactNode } from "react";
import { ArrowRight,CalendarDays,Check,Plus,Sparkles } from "lucide-react";
import { localDate,type AppState,type Day } from "@/lib/model";
import { occurrencesInWindow } from "@/lib/planner";
import { emptyPlanner,type Planner,type PlannerBlock } from "@/lib/planner-model";
import { toggleTodo,upsertTodo,todosForDate } from "@/lib/planner-todos";
import type { PetResult } from "@/lib/pet-model";
import { PetAnimator } from "./pet-animator";
import { SupplementChecks } from "./supplement-workspace";
import type { SupplementStore } from "./use-supplement-journal";
import { useVisibleMinute } from "./use-visible-minute";

export function TodayChecks({app,day,store,pet,busy,onPlan,onManage,onCheckin,onCustom,onPet,onSavePlanner,onRecord,onBasic,onChecked,checkReaction,children}:{app:AppState;day?:Day;store:SupplementStore;pet:PetResult|null;busy:boolean;onPlan:()=>void;onManage:()=>void;onCheckin:()=>void;onCustom:()=>void;onPet:()=>void;onSavePlanner:(p:Planner)=>Promise<void>;onRecord:(b:PlannerBlock,date:string)=>void;onBasic:()=>void;onChecked:()=>void;checkReaction?:string;children:ReactNode}){
  const [expanded,setExpanded]=useState(false),[title,setTitle]=useState(""),[error,setError]=useState(""),[lastTodo,setLastTodo]=useState<string>();
  const now=useVisibleMinute(),today=localDate(),planner=app.planner??emptyPlanner();
  const minute=now?(now.getUTCHours()*60+now.getUTCMinutes()+540)%1440:null;
  const events=occurrencesInWindow(planner,today),remaining=events.filter(o=>minute===null||o.until>minute);
  const agenda=(remaining.length?remaining:events).slice(0,2);
  const todos=todosForDate(planner,today).filter(t=>t.status!=="done").slice(0,3);
  const saveTodo=async()=>{if(!title.trim()||busy)return;try{setError("");await onSavePlanner(upsertTodo(planner,{id:crypto.randomUUID(),title:title.trim(),status:"open",todayDate:today,location:"",notes:"",checklist:[]}));setTitle("");}catch(e){setError((e as Error).message);}};
  const done=day?.routines.filter(r=>day.statuses[r.id]==="done").length??0;
  return <div className="today-hub">
    <button type="button" className="home-companion panel" onClick={onPet}>
      {pet?.document?.visible!==false&&<PetAnimator baseState={pet?.view?.baseState??"idle"} reducedMotion={pet?.document?.reducedMotion??false} reactionId={checkReaction??pet?.reactionId} name={pet?.document?.name??"새 친구"}/>}
      <span><small>작은 실천으로 함께 성장</small><strong>{checkReaction?"한 가지 해냈어요. 함께 기뻐해요!":`${pet?.document?.name??"나의 사모예드"}와 오늘도 한 걸음`}</strong><small>{done}개 루틴 완료 · {pet?.document?"내 친구의 상태와 성장 보기":"친구를 만나보세요 · 활동 기록은 입양 없이도 가능해요"}</small></span><ArrowRight size={18}/>
    </button>
    <div className="home-agenda-grid">
      <section className="panel home-agenda" aria-label="지금과 다음 일정"><header><h2><CalendarDays size={17}/>지금 · 다음 일정</h2><button className="text-link" onClick={onPlan}>계획 보기<ArrowRight size={14}/></button></header>
        {agenda.map(o=>{const recorded=planner.records?.some(r=>r.blockId===o.block.id&&r.date===o.date&&r.status==="done"),active=minute!==null&&o.from<=minute&&o.until>minute;return <div className={`home-agenda-row ${active?"is-current":""}`} key={`${o.block.id}-${o.date}`}><button className="routine-check" disabled={busy} aria-label={`${o.block.title} 일정 ${recorded?"완료 취소":"완료"}`} aria-pressed={!!recorded} onClick={()=>onRecord(o.block,o.date)}>{recorded&&<Check size={16}/>}</button><div><small>{active?"진행 중인 예정 일정":minute!==null&&o.from>minute?`${o.from-minute}분 뒤 예정`:"등록한 일정"} · {o.block.start}–{o.block.end}</small><b>{o.block.title}</b><span>{o.block.location}</span></div></div>;})}
        {!agenda.length&&<div className="home-empty"><p>오늘의 약속을 하나 담아볼까요?</p><button className="button secondary" onClick={onPlan}><Plus size={15}/>첫 일정 추가</button></div>}
      </section>
      <section className="panel home-todos" aria-label="오늘 해야 할 일"><header><h2>오늘의 To-do</h2><small>시간 미정도 괜찮아요</small></header>
        {todos.map(t=><label key={t.id} className="home-todo"><input type="checkbox" disabled={busy} checked={false} onChange={()=>void onSavePlanner(toggleTodo(planner,t.id)).then(()=>{setLastTodo(t.id);onChecked();}).catch(e=>setError(e.message))}/><span>{t.title}</span></label>)}
        {!todos.length&&<p className="muted">작은 할 일 하나로 시작해요.</p>}
        <form className="home-todo-add" onSubmit={e=>{e.preventDefault();void saveTodo();}}><input aria-label="오늘 할 일 제목" maxLength={60} placeholder="할 일 제목만 입력" value={title} onChange={e=>setTitle(e.target.value)}/><button className="icon-button" disabled={busy||!title.trim()} aria-label="오늘 할 일 추가"><Plus size={18}/></button></form>
        {lastTodo&&planner.todos?.some(t=>t.id===lastTodo&&t.status==="done")&&<button className="text-link" disabled={busy} onClick={()=>void onSavePlanner(toggleTodo(planner,lastTodo)).then(()=>setLastTodo(undefined)).catch(e=>setError(e.message))}>방금 한 일 체크 되돌리기</button>}{error&&<p className="form-error" role="alert">{error}</p>}
      </section>
    </div>
    <section className="today-check-panel panel" aria-label="오늘의 루틴"><header><h2>오늘, 이것만 해볼까요?</h2><div><button className="text-link" disabled={busy} onClick={onCheckin}><Sparkles size={14}/>분량 조절</button><button className="text-link" disabled={busy} onClick={onCustom}><Plus size={14}/>직접 추가</button></div></header>
      <div className={`today-routine-rows ${expanded?"is-expanded":"is-preview"}`}>{children}{(day?.routines.length??0)>3&&<button className="text-link today-show-more" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?"접기":`${day!.routines.length-3}개 더 보기`}</button>}</div>
      {!day&&<button className="text-link" onClick={onBasic}>질문 없이 추천받기</button>}
    </section>
    {store.journal.products.some(p=>p.active)&&<section className="panel home-care"><header><h2>오늘의 복용 체크</h2><button className="text-link" onClick={onManage}>관리</button></header><SupplementChecks store={store} app={app} compact onManage={onManage}/></section>}
  </div>;
}
