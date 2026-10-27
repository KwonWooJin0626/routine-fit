"use client";
import { CalendarDays, Sparkles } from "lucide-react";
import type { Answers } from "@/lib/model";

export function PlanningStyleChoice({value,onChange,busy=false}:{value:Answers["planningStyle"];onChange:(v:"spontaneous"|"planned")=>void;busy?:boolean}){
  return <section className="style-choice" aria-label="하루 계획 이용 방식"><div><span className="eyebrow">YOUR DAY, YOUR WAY</span><h2 data-step-heading tabIndex={-1}>어떤 방식으로 하루를 시작할까요?</h2><p>성격 검사가 아니라 이용 방식이에요. 언제든 바꿔도 일정과 기록은 유지돼요.</p></div><div className="style-options"><button type="button" disabled={busy} aria-pressed={value==="spontaneous"} onClick={()=>onChange("spontaneous")}><Sparkles/><b>즉흥형</b><span>오늘의 짧은 질문 → 바로 추천</span><small>오늘 할 활동과 컨디션에 맞춰 가볍게 시작해요.</small></button><button type="button" disabled={busy} aria-pressed={value==="planned"} onClick={()=>onChange("planned")}><CalendarDays/><b>계획형</b><span>주간 일정 → 날짜별 맞춤 루틴</span><small>고정 일정과 약속 사이에 작은 실천을 더해요.</small></button></div></section>;
}
