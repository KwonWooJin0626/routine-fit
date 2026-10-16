"use client";
import { useId } from "react";
import { ArrowRight,LoaderCircle } from "lucide-react";

export function PlannerRoutineAction({selected,today,busy,onGoToday,onGenerate,onPreview}:{selected:string;today:string;busy:boolean;onGoToday:()=>void;onGenerate:()=>void;onPreview:()=>void}){
  const isToday=selected===today,id=useId();
  const message=busy?"저장 또는 루틴 생성 작업을 처리하고 있어요. 완료되면 다시 사용할 수 있어요.":isToday?`오늘(${today})의 일정과 실제 컨디션을 바탕으로 루틴을 만들어요.`:`선택한 날짜는 ${selected}입니다. 이 날짜의 일정과 예상 컨디션으로 루틴을 미리 볼 수 있어요. 오늘(${today})의 루틴과 실천 기록에는 반영되지 않아요.`;
  return <div className="sp-routine-link"><div><b>{isToday?"이 하루 계획을 바탕으로 오늘의 루틴 만들기":"이 날짜의 계획으로 루틴 미리 보기"}</b><p>일정 사이 여유와 입력한 부담·피로도를 참고해 추천합니다. 실제 컨디션 체크가 우선이며, 의료적 진단은 하지 않아요.</p><p id={id} className="sp-routine-action-status" role="status" aria-live="polite">{message}</p></div><div className="sp-routine-actions"><button className="button primary" disabled={busy} aria-busy={busy} aria-describedby={id} onClick={isToday?onGenerate:onPreview}>{busy?<><LoaderCircle className="spin" size={16} aria-hidden="true"/>저장·처리 중…</>:<>{isToday?"오늘의 루틴 만들기":`${selected} 루틴 미리보기`}<ArrowRight size={16} aria-hidden="true"/></>}</button>{!isToday&&<button className="button secondary" disabled={busy} onClick={onGoToday}>오늘 날짜로 이동</button>}</div></div>;
}
