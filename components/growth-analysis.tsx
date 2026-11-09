"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { localDate,type AppState } from "@/lib/model";
import type { PetDocument } from "@/lib/pet-model";
import { growthAnalysis } from "@/lib/growth-analysis";
import { sleepRanges,exerciseRanges,sittingRanges } from "@/lib/basic-profile";
import { LifestyleCharts } from "./lifestyle-charts";

export function GrowthAnalysis({state,onPlan,onRefine,onLegacy,pet,loading=false,error=""}:{state:AppState;onPlan:()=>void;onRefine:()=>void;onLegacy?:()=>void;pet?:PetDocument|null;loading?:boolean;error?:string}){
  const [date,setDate]=useState(localDate());
  const data=growthAnalysis(state,date),b=state.answers.basic;
  return <div className="growth-analysis">
    <div className="lc-intro"><p><Sparkles size={17}/>일정과 실천을 한눈에 살펴봐요.</p><button className="text-link" onClick={onRefine}>목표·가능 시간 조정</button></div>
    <LifestyleCharts state={state} date={date} onDate={setDate} pet={pet} loading={loading} error={error} onPlan={onPlan}/>
    <details className="panel"><summary>선택한 주의 기록 요약 · {data.start} ~ {data.dates[6]}</summary><div className="report-metrics"><section className="panel"><span>예정 일정 기준</span><strong>{data.coveredDays}<small>일</small></strong><p>일정이 등록된 날짜</p></section><section className="panel"><span>등록 일정의 시간 범위 합계</span><strong>{Math.round(data.plannedMinutes/60*10)/10}<small>시간</small></strong><p>겹친 구간은 한 번만 계산</p></section><section className="panel"><span>실제 완료 체크</span><strong>{data.done}<small>개</small></strong><p>직접 남긴 일정 기록 {data.records.length}개 중 완료</p></section></div><span className="eyebrow">RECORDED · 실행 기록 기준</span><p>일정 체크 {data.records.length}개 · 루틴 기록 {data.routineDays.length}일. 미기록은 실패로 계산하지 않아요.</p></details>
    {b&&<details className="panel"><summary>처음 알려주신 기초 정보</summary><div className="basic-facts"><span>수면 <b>{sleepRanges[b.sleepRange]}</b></span><span>주간 운동 <b>{exerciseRanges[b.exerciseRange]}</b></span><span>하루 좌식 <b>{sittingRanges[b.sittingRange]}</b></span></div><p className="muted">범위 응답이에요. 정확한 수치나 종합 건강점수로 환산하지 않아요.</p></details>}
    {onLegacy&&<details className="panel"><summary>이전에 작성한 상세 건강 설문</summary><p>기존 답변은 보관되어 있어요. 예전 설문을 기반으로 한 참고 자료를 별도로 확인할 수 있어요.</p><button className="text-link" onClick={onLegacy}>이전 상세 분석 보기</button></details>}
  </div>;
}
