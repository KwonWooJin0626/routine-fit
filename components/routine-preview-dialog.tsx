"use client";
import { useMemo,useState } from "react";
import { Eye,CalendarDays,Clock3,ShieldCheck } from "lucide-react";
import { type AppState,type Checkin,categoryLabels,initialCheckin,checkinSchema } from "@/lib/model";
import { buildRoutinePreview } from "@/lib/routine-preview";
import { conditionSummary } from "@/lib/routine-catalog";
import { guidanceForRoutine } from "@/lib/routine-guidance";
import { Dialog,Input,Scale,Select,Toggle } from "./forms";
import { RoutineSources } from "./evidence-sources";
import { RoutineGuidance } from "./routine-guidance";

export function RoutinePreviewDialog({state,date,today,onClose}:{state:AppState;date:string;today:string;onClose:()=>void}){
  const [expected,setExpected]=useState(()=>initialCheckin(state.answers)),[draft,setDraft]=useState(()=>initialCheckin(state.answers));
  const [mode,setMode]=useState<"core"|"full">("core"),[error,setError]=useState("");
  const result=useMemo(()=>{try{return {day:buildRoutinePreview(state,date,expected,mode,today),error:""};}catch{return {day:undefined,error:"미리보기를 만들지 못했어요. 날짜와 예상 컨디션의 입력 범위를 확인해주세요."};}},[state,date,expected,mode,today]);
  const day=result.day;
  const change=<K extends keyof Checkin>(key:K,value:Checkin[K])=>setDraft(old=>({...old,[key]:value}));
  const apply=()=>{const p=checkinSchema.safeParse(draft);if(!p.success){setError("수면은 0~14시간, 건강관리 시간은 5~60분 범위로 입력해주세요.");return;}setError("");setExpected(p.data);};
  return <Dialog title={`${date} 루틴 미리보기`} subtitle="선택한 날짜의 일정과 예상 컨디션을 바탕으로 계산한 참고용 추천이에요." onClose={onClose} wide resetKey={mode}>
    <div className="note"><Eye size={20}/><div><b>미리보기 전용 · 저장되지 않아요</b><p>오늘의 루틴·완료 기록·주간 리포트는 바뀌지 않아요. 실제 그날에는 컨디션을 확인하고 다시 생성해주세요. 기상·식사·이동 및 기본 일정 설정도 함께 참고해요.</p>{date<today&&<p>과거 날짜는 현재 문진과 현재 시간표를 바탕으로 다시 계산한 가정이며, 당시 실천 기록을 재현한 결과가 아니에요.</p>}</div></div>
    <div className="sp-preview-mode sp-view-switch" role="group" aria-label="미리보기 유형"><button aria-pressed={mode==="core"} onClick={()=>setMode("core")}>핵심 루틴</button><button aria-pressed={mode==="full"} onClick={()=>setMode("full")}>하루 전체 배치</button></div>
    <details className="optional-questions sp-preview-conditions"><summary>예상 컨디션 바꿔 보기</summary><p>처음에는 생활패턴 문진의 기본값을 사용해요. 아래 값은 미리보기에만 적용되며 실제 체크인으로 저장되지 않아요.</p><form onSubmit={e=>{e.preventDefault();apply();}}><div className="form-grid"><Input label="예상 수면시간" type="number" min={0} max={14} required value={draft.sleep} onChange={v=>change("sleep",Number(v))}/><Input label="예상 건강관리 시간 (분)" hint="걷기·스트레칭·식사 준비 등 추가로 실천할 시간" type="number" min={5} max={60} required value={draft.minutes} onChange={v=>change("minutes",Number(v))}/><Scale label="예상 에너지" value={draft.energy} onChange={v=>change("energy",v)}/><Scale label="예상 스트레스" value={draft.stress} onChange={v=>change("stress",v)}/><Select label="예상 활동 장소" value={draft.place} options={{home:"집",office:"학교·사무실",outside:"야외",gym:"운동 시설"}} onChange={v=>change("place",v as Checkin["place"])}/><Toggle label="바쁜 하루가 예상돼요" checked={draft.busy} onChange={v=>change("busy",v)}/><div className="form-span"><Toggle label="몸이 불편한 상태를 가정해요" hint="회복 위주의 추천을 미리 확인할 수 있어요." checked={draft.unwell} onChange={v=>change("unwell",v)}/></div></div>{error&&<p className="form-error" role="alert">{error}</p>}<button className="button secondary" type="submit">예상 조건 반영</button></form></details>
    {result.error&&<p className="form-error" role="alert">{result.error}</p>}
    {day&&<><div className="sp-preview-summary" role="status"><span><CalendarDays size={17}/>{date}</span><span><Clock3 size={17}/>{day.routines.filter(r=>!r.held).reduce((n,r)=>n+r.minutes,0)}분 · {day.routines.length}개 루틴</span><p>적용한 예상 조건: {conditionSummary(expected)}</p>{day.planningContext&&<p>날짜별 일정 {day.planningContext.importedIds.length}개 반영 · 예상 부담 {day.planningContext.mental}/5 · 예상 피로 {day.planningContext.physical}/5 · 추천 시간 {day.planningContext.effectiveMinutes}분 이내</p>}</div>
      {day.warnings.map((w,i)=><p key={i} className="note">{w}</p>)}
      <div className="sp-preview-routines">{day.routines.map((r,i)=><article key={r.id}><header><span>{String(i+1).padStart(2,"0")} · {categoryLabels[r.category]}</span><b>{r.held?"실천 보류":`${r.minutes}분`}</b></header><h3>{r.title}</h3><p>{r.detail}</p><RoutineSources routine={r}/><details className="sp-preview-reason"><summary>추천 이유와 쉬운 대안</summary><p>{r.reason}</p><p>{r.fallback}</p></details><RoutineGuidance guide={guidanceForRoutine(r,state.answers)}/></article>)}</div>
      {!day.routines.length&&<p className="sp-empty-day">일정 사이 여유가 부족해 루틴을 추가하지 않았어요. 식사·휴식 시간을 먼저 확보해주세요.</p>}
      {mode==="full"&&<section className="sp-preview-timeline" aria-label="선택 날짜의 예상 전체 계획"><h3>예상 하루 전체 계획</h3>{day.timeline.length>0?<ol>{day.timeline.map(t=><li key={t.id}><time>{t.start}–{t.end}</time><div><small>{t.routineId?"추천 루틴":"일정·식사·휴식"}</small><b>{t.title}</b><p>{t.detail}</p></div></li>)}</ol>:<p>배치할 항목이 없어요. 일정이나 예상 조건을 확인해주세요.</p>}</section>}
    </>}
    <div className="note"><ShieldCheck size={18}/><span>예상 조건과 사용자가 입력한 부담·피로도에 따른 참고 정보이며 의료적 진단은 아닙니다. 이 화면에서는 실천 체크를 제공하지 않아요.</span></div><div className="dialog-actions"><button className="button primary" onClick={onClose}>미리보기 닫기</button></div>
  </Dialog>;
}
