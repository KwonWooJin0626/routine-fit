"use client";
import { useState,type ReactNode } from "react";
import { ArrowRight,CalendarDays,PawPrint,Plus,Sparkles } from "lucide-react";
import { localDate,type AppState,type Day } from "@/lib/model";
import { occurrencesInWindow } from "@/lib/planner";
import { supplementOccurrences } from "@/lib/supplement-journal";
import type { PetResult } from "@/lib/pet-model";
import { PetAnimator } from "./pet-animator";
import { SupplementChecks } from "./supplement-workspace";
import type { SupplementStore } from "./use-supplement-journal";
export function TodayChecks({app,day,store,pet,busy,onPlan,onManage,onCheckin,onCustom,onPet,children}:{app:AppState;day?:Day;store:SupplementStore;pet:PetResult|null;busy:boolean;onPlan:()=>void;onManage:()=>void;onCheckin:()=>void;onCustom:()=>void;onPet:()=>void;children:ReactNode}){
  const [expanded,setExpanded]=useState(false);
  const [filter,setFilter]=useState("all"),today=localDate(),doses=supplementOccurrences(store.journal,today,app),events=occurrencesInWindow(app.planner,today),next=events.find(o=>o.until>(new Date().getUTCHours()*60+new Date().getUTCMinutes()+540)%1440);
  const done=day?.routines.filter(r=>day.statuses[r.id]==="done").length??0,total=day?.routines.filter(r=>!r.held||day.statuses[r.id]==="done").length??0;
  return <div className="today-hub"><div className="today-summary panel"><div><span>루틴 완료</span><b>{done}<small>/{total}</small></b></div><div><span>복용 기록</span><b>{doses.filter(o=>o.record?.status==="taken").length}<small>/{doses.length}</small></b></div><div><span>오늘 일정</span><b>{events.length}<small>개</small></b></div><button type="button" className="today-pet-button" onClick={onPet} aria-label="사모예드 상태와 활동 관리"><PetAnimator reducedMotion={pet?.document?.reducedMotion??false} baseState={pet?.view?.baseState??"idle"} name={pet?.document?.name??"새 친구"}/><span>{pet?.document?.name??"나의 사모예드"}<PawPrint size={13}/></span></button></div>
    <div className="today-hub-grid"><section className="today-check-panel panel" aria-label="오늘의 통합 체크"><header><h2>오늘의 체크</h2><button className="text-link" disabled={busy} onClick={onCustom}><Plus size={14}/>루틴 추가</button></header><div className="today-filter" role="group" aria-label="오늘 체크 종류">{[["all","전체"],["routines","루틴"],["supplements","영양제"]].map(([key,label])=><button key={key} type="button" aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>{filter!=="supplements"&&<div className={`today-routine-rows ${expanded?"is-expanded":"is-preview"}`}>{children}{(day?.routines.length??0)>3&&<button className="text-link today-show-more" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?"루틴 접기":`루틴 ${day!.routines.length-3}개 더 보기`}</button>}</div>}{filter!=="routines"&&<SupplementChecks store={store} app={app} compact onManage={onManage}/>}</section><aside className="today-hub-context"><section className="panel"><h3><CalendarDays size={17}/>다음 일정</h3>{next?<><p className="next-time">{next.block.start}–{next.block.end}</p><b>{next.block.title}</b><p className="muted">{next.block.location||"계획표에 등록한 일정"}</p></>:<p className="muted">{events.length?"예정된 일정이 모두 지났어요. 실제 수행을 기록해요.":"일정을 담으면 오늘의 준비를 도와드려요."}</p>}<button className="text-link" onClick={onPlan}>계획표 보기<ArrowRight size={14}/></button></section><section className="panel"><h3>빠른 관리</h3><button className="text-link" onClick={onCheckin}><Sparkles size={14}/>오늘 컨디션 체크</button><button className="text-link" onClick={onManage}>내 영양제·복용 계획</button><button className="text-link" onClick={onPet}>사모예드·활동 관리</button></section></aside></div>
  </div>;
}
