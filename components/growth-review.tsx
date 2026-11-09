"use client";
import { useState } from "react";
import type { AppState } from "@/lib/model";
import { addDate,mondayOf,occurrencesInWindow } from "@/lib/planner";
import { growthProposal } from "@/lib/growth-proposal";
import { lifestyleCharts } from "@/lib/lifestyle-charts";
import type { PlannerBlock } from "@/lib/planner-model";
import { Dialog } from "./forms";
/** A proposal is previewed; fixed events are never moved automatically. */
export function GrowthReview({state,date,onPlan,onProposal}:{state:AppState;date:string;onPlan:()=>void;onProposal?:(block:PlannerBlock)=>Promise<void>}){
  const [preview,setPreview]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(""),start=mondayOf(date),dates=Array.from({length:7},(_,i)=>addDate(start,i));
  const proposal=growthProposal(state,date),rows=lifestyleCharts(state,date,"week","planned").days.map(d=>({date:d.date,minutes:d.occupied})),busiest=[...rows].sort((a,b)=>b.minutes-a.minutes)[0];
  const done=state.planner?.records?.filter(r=>dates.includes(r.date)&&r.status==="done").length??0;
  return <section className="panel growth-review"><div><small>잘한 점</small><h3>{done?`일정 ${done}개를 마쳤어요`:"기록을 시작할 준비가 됐어요"}</h3></div><div><small>관찰</small><p>{busiest.minutes?`${busiest.date.slice(5)}에 예정 일정이 가장 많아요 (${Math.round(busiest.minutes/60*10)/10}시간).`:"이번 주 일정을 담으면 시간의 흐름을 볼 수 있어요."}</p></div><div><small>다음 행동</small><button className="text-link" onClick={()=>setPreview(true)}>일정 사이 짧은 실천 미리보기 →</button></div>
    {preview&&<Dialog title="다음 계획 조정 미리보기" onClose={()=>setPreview(false)}><p>등록된 약속은 그대로 두고, 실제로 가능한 시간인지 확인한 뒤 5분 휴식을 더해요.</p>{proposal?<div className="pace-preview"><b>추가 제안 · {proposal.title}</b><p>{proposal.date} · {proposal.start}–{proposal.end}</p><small>계획표에서 비어 있는 구간이에요. 사용 가능한 시간이라는 뜻은 아니에요.</small></div>:<p>다음 주 낮 시간에 겹치지 않는 구간을 찾지 못했어요. 다른 시간을 직접 선택해주세요.</p>}<ul>{state.planner?.blocks.filter(b=>b.date<=dates[6]).slice(0,3).map(b=><li key={b.id}>{b.title} · {b.start}–{b.end} <small>시간 유지</small></li>)}</ul><p className="muted">빈 시간은 사용 가능한 시간으로 확정하지 않아요. 계획표에서 날짜와 시간을 직접 확인한 후 저장해요.</p>{error&&<p className="form-error" role="alert">{error}</p>}{proposal&&onProposal&&<button className="button primary" disabled={saving} onClick={async()=>{setSaving(true);setError("");try{await onProposal({...proposal,id:crypto.randomUUID()});setPreview(false);}catch(e){setError((e as Error).message);}finally{setSaving(false);}}}>이 시간이 가능해요 · 휴식 담기</button>}<button className="button secondary" disabled={saving} onClick={onPlan}>계획표에서 다른 시간 선택</button></Dialog>}
  </section>;
}
