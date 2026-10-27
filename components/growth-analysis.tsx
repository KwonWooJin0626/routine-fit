"use client";
import { useState } from "react";
import { CalendarDays, LockKeyhole, Sparkles } from "lucide-react";
import { localDate, type AppState } from "@/lib/model";
import { growthAnalysis } from "@/lib/growth-analysis";
import { sleepRanges,exerciseRanges,sittingRanges } from "@/lib/basic-profile";
import { Input } from "./forms";

export function GrowthAnalysis({state,onPlan,onRefine,onLegacy}:{state:AppState;onPlan:()=>void;onRefine:()=>void;onLegacy?:()=>void}){
  const [date,setDate]=useState(localDate());
  const data=growthAnalysis(state,date),b=state.answers.basic;
  return <div className="growth-analysis">
    <section className="panel growth-unlock"><Sparkles size={24}/><div><h2>계획으로 살펴보고, 기록으로 더 정확하게.</h2><p>예정한 일정과 실제 실행 기록을 구분해요. 등록되지 않은 시간은 자유 시간이나 휴식으로 단정하지 않아요.</p></div><button className="button secondary" onClick={onRefine}>목표·가능 시간 조정</button></section>
    {b&&<section className="panel"><h3>처음 알려주신 기초 정보</h3><div className="basic-facts"><span>수면 <b>{sleepRanges[b.sleepRange]}</b></span><span>주간 운동 <b>{exerciseRanges[b.exerciseRange]}</b></span><span>하루 좌식 <b>{sittingRanges[b.sittingRange]}</b></span></div><p className="muted">범위 응답이에요. 정확한 수치나 종합 건강점수로 환산하지 않아요.</p></section>}
    <div className="growth-week-filter"><Input label="살펴볼 주의 날짜" type="date" value={date} onChange={v=>{if(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(new Date(v).getTime()))setDate(v);}}/><span>{data.start} ~ {data.dates[6]}</span></div>
    {!data.unlocked?<section className="panel unlock-empty"><LockKeyhole size={30}/><h2>계획표를 작성하면 생활패턴 분석이 열려요</h2><p>이 주에는 등록된 일정이 없어요. 하루만 작성해도 해당 날짜의 시간 배분을 살펴볼 수 있어요.</p><button className="button primary" onClick={onPlan}><CalendarDays size={17}/>계획표 작성하기</button></section>:<>
      <div className="report-metrics"><section className="panel"><span>예정 일정 기준</span><strong>{data.coveredDays}<small>일</small></strong><p>일정이 등록된 날짜 · 작성한 날만 분석</p></section><section className="panel"><span>등록 일정의 시간 범위 합계</span><strong>{Math.round(data.plannedMinutes/60*10)/10}<small>시간</small></strong><p>식사·휴식 블록을 포함한 예정 시간</p></section><section className="panel"><span>실제 완료 체크</span><strong>{data.done}<small>개</small></strong><p>직접 남긴 일정 기록 {data.records.length}개 중 완료</p></section></div>
      <section className="panel"><span className="eyebrow">PLANNED · 예정 일정 기준</span><h2>어디에 시간을 배분했나요?</h2><div className="growth-bars">{data.categories.map(c=><div key={c.key}><span>{c.label}</span><progress max={Math.max(...data.categories.map(x=>x.minutes))} value={c.minutes}/><b>{Math.floor(c.minutes/60)}시간 {c.minutes%60}분</b></div>)}</div><p className="muted">실제 수행·섭취·휴식 시간은 아니에요. 일정 안의 휴식과 이동은 상세 블록에서 확인해주세요.</p></section>
    </>}
    <section className="panel"><span className="eyebrow">RECORDED · 실행 기록 기준</span><h2>실제로 남긴 기록</h2><p>일정 체크 {data.records.length}개 · 루틴 기록 {data.routineDays.length}일</p><p>{data.records.length||data.routineDays.length?"완료·조금 진행·어려웠던 이유를 다음 루틴 조정에 활용해요. 미기록은 실패로 계산하지 않아요.":"아직 이 주의 실행 기록이 없어요. 일정을 작성한 것만으로 수행했다고 처리하지 않아요."}</p></section>
    {onLegacy&&<details className="panel"><summary>이전에 작성한 상세 건강 설문</summary><p>기존 답변은 보관되어 있어요. 예전 설문을 기반으로 한 참고 자료를 별도로 확인할 수 있어요.</p><button className="text-link" onClick={onLegacy}>이전 상세 분석 보기</button></details>}
  </div>;
}
