"use client";
import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import type { AppState, Routine } from "@/lib/model";
import { localDate } from "@/lib/model";
import { mondayOf, addDate } from "@/lib/planner";
import { activityDomains, activityGoals, type ActivityFeedback } from "@/lib/activity-profile";
import { activityMinutesOn } from "@/lib/activity-recommendations";
import { ChoiceButtons } from "./choice-buttons";
import { Input } from "./forms";

export function ActivityGoals({state,busy,onRefine,onPlan}:{state:AppState;busy:boolean;onRefine:()=>void;onPlan:()=>void}){
  const pending=state.answers.activities?.pendingDomains??[];
  const profiles=state.answers.activities?.profiles.filter(p=>p.enabled)??[],today=localDate(),start=mondayOf(today),end=addDate(start,6);
  return <section className="activity-goals" aria-label="나의 분야별 목표"><header><div><span className="eyebrow">MAKE IT YOURS</span><h2>{profiles.length?"내 목표에서 시작하는 루틴":"어떤 활동인지까지, 나에게 맞게"}</h2><p>{profiles.length?"희망 목표·예정 분량·직접 기록한 실천 시간을 구분해요.":"운동·공부·독서 등 관심 분야를 고르면 후보를 먼저 보여드려요. 선택한 활동만 더 알아봐요."}</p></div><button className="button primary" disabled={busy} onClick={onRefine}><Sparkles size={16}/>{pending.length?`${activityDomains[pending[0]]} 질문 이어하기`:profiles.length?"목표·활동 수정":"루틴 구체화 시작"}</button></header>
    {!!pending.length&&<div className="activity-next-note"><b>완료한 분야의 결과부터 살펴보세요.</b><p>{pending.map(d=>activityDomains[d]).join(" · ")} 설문이 남아 있어요. 다음 분야는 준비됐을 때 이어갈 수 있어요. 새로고침하거나 다시 로그인해도 완료한 분야는 유지돼요.</p></div>}
    {!!profiles.length&&<div className="activity-goal-grid">{profiles.map(p=>{
      const actual=state.days.filter(d=>d.date>=start&&d.date<=end&&d.date<=today).reduce((n,d)=>n+d.routines.filter(r=>r.activity?.domain===p.domain).reduce((sum,r)=>sum+(d.activityFeedback?.[r.id]?.actualMinutes??0),0),0);
      const checked=state.days.filter(d=>d.date>=start&&d.date<=end&&d.date<=today).flatMap(d=>d.routines.filter(r=>r.activity?.domain===p.domain&&d.statuses[r.id]==="done")).length;
      const planned=activityMinutesOn(p,today);
      return <article key={p.domain}><b>{activityDomains[p.domain]} · {activityGoals[p.domain][p.goal]}</b><p>{p.weekly===null?"주간 목표 없음":`주간 목표 ${p.weekly}분`} · 오늘 예정 {planned}분</p><p>직접 기록한 실제 시간 <strong>{actual}분</strong> · 완료 체크 {checked}회</p><small>시간 미입력은 0분 수행으로 판정하지 않아요.</small></article>;
    })}</div>}
    <footer><span>{profiles.length?"요일·활동 목표는 유지하고 오늘의 컨디션과 가능한 시간으로 분량을 조정해요.":"기초 질문을 반복하지 않아요. 완료한 분야는 저장하고, 작성 중인 분야의 미확정 답변만 닫으면 사라져요."}</span><button className="text-link" onClick={onPlan}>계획표로 정밀화 <ArrowRight size={14}/></button></footer>
  </section>;
}
export function ActivityFeedbackForm({routine,initial,busy,onSave}:{routine:Routine;initial?:ActivityFeedback;busy:boolean;onSave:(feedback:ActivityFeedback)=>Promise<void>}){
  const [reason,setReason]=useState<ActivityFeedback["reason"]>(initial?.reason),[actual,setActual]=useState<string>(initial?.actualMinutes==null?"":String(initial.actualMinutes)),[error,setError]=useState("");
  return <details className="activity-feedback"><summary>다음 추천을 위한 피드백·실제 시간 (선택)</summary><p>예정한 {routine.activity?.goalMinutes??routine.minutes}분을 실제로 했다고 자동 기록하지 않아요. 필요할 때만 남겨주세요.</p><ChoiceButtons label="다음 추천에 참고할 점" value={reason??""} options={{okay:"적당했어요",time:"시간이 부족했어요",hard:"너무 어려웠어요",dislike:"다른 활동을 원해요",environment:"환경이 안 맞아요",condition:"컨디션",other:"다른 활동을 했어요"}} onChange={v=>setReason(v as ActivityFeedback["reason"])}/><Input label="실제로 한 시간 (분, 선택)" type="number" min={0} max={240} value={actual} onChange={setActual} hint="모르면 비워두세요. 다른 활동을 했다면 그 활동의 시간도 직접 입력할 수 있어요."/>{error&&<p className="form-error" role="alert">{error}</p>}<div className="activity-feedback-actions"><button className="text-link" type="button" disabled={busy} onClick={()=>{setReason(undefined);setActual("");}}>입력 비우기</button><button className="button secondary" type="button" disabled={busy} onClick={async()=>{const minutes=actual.trim()===""?null:Number(actual);if(minutes!==null&&(!Number.isInteger(minutes)||minutes<0||minutes>240)){setError("실제 시간은 0~240분의 정수로 입력해주세요.");return;}try{setError("");await onSave({reason,actualMinutes:minutes,recordedAt:new Date().toISOString()});}catch(e){setError((e as Error).message);}}}>피드백 저장</button></div></details>;
}
