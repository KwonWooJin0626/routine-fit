"use client";
import { useId, useState } from "react";
import { ArrowRight, CalendarDays, ChevronDown, Leaf } from "lucide-react";
import type { AppState } from "@/lib/model";
import { emptyNutritionProfile, type NutritionProfile } from "@/lib/nutrition-profile";
import { exerciseMode, saveScheduleAnswer, scheduleNutrition, type ScheduleGuide } from "@/lib/schedule-nutrition";
import { ChoiceButtons } from "./choice-buttons";

type Props={state:AppState;date:string;busy:boolean;compact?:boolean;onSave:(p:NutritionProfile)=>Promise<void>;onInspect?:(id:string)=>void;onOpen?:()=>void;onPlan?:()=>void};
export function ScheduleNutrition({state,date,busy,compact=false,onSave,onInspect,onOpen,onPlan}:Props){
  const [question,setQuestion]=useState<string|null>(null),[error,setError]=useState("");
  const heading=useId(),result=scheduleNutrition(state,date),profile=state.nutrition??emptyNutritionProfile();
  if(!state.answers.supplementOptIn)return null;
  const save=async(next:NutritionProfile)=>{try{setError("");await onSave(next);}catch(e){setError((e as Error).message);}};
  const inspect=(id:string)=>onInspect?onInspect(id):onOpen?.();
  const rows=<>
    {!result.hasSchedule?<div className="schedule-nutrition-empty"><p>이 날짜에 등록된 일정이 아직 없어요. 일정을 담으면 활동에 맞는 영양 가이드를 먼저 보여드려요.</p>{onPlan&&<button type="button" className="button secondary" onClick={onPlan}>계획표에 일정 담기 <ArrowRight size={14}/></button>}</div>:<>
      <div className="schedule-nutrition-meta"><span>{date} · 등록된 계획 기준</span>{result.exerciseMinutes>0&&<span>운동 예정 {result.exerciseMinutes}분 · 최근 7일 계획 중 운동 {result.weeklyExerciseDays}일</span>}</div>
      {!result.guides.length&&<p>현재 일정에서 별도로 강조할 영양 항목은 없어요. 평소 식사와 휴식을 챙기면 돼요. 추천 수를 채우기 위해 보충제를 추가하지 않아요.</p>}
      <div className="schedule-nutrition-list">{result.guides.slice(0,3).map(guide=><GuideCard key={`${date}-${guide.id}`} guide={guide} busy={busy} active={question===guide.id} onExpand={()=>setQuestion(question===guide.id?null:guide.id)} onAnswer={answer=>void save(saveScheduleAnswer(profile,date,guide.id as "protein"|"meal"|"hydration",guide.context,answer))} onInspect={onInspect||onOpen?inspect:undefined}/>)}</div>
      {result.guides.length>3&&<details className="schedule-nutrition-more"><summary>다른 일정 가이드 {result.guides.length-3}개</summary><div className="schedule-nutrition-list">{result.guides.slice(3).map(guide=><GuideCard key={`${date}-${guide.id}`} guide={guide} busy={busy} active={question===guide.id} onExpand={()=>setQuestion(question===guide.id?null:guide.id)} onAnswer={answer=>void save(saveScheduleAnswer(profile,date,guide.id as "protein"|"meal"|"hydration",guide.context,answer))} onInspect={onInspect||onOpen?inspect:undefined}/>)}</div></details>}
      {result.exerciseChoices.length>0&&<details className="schedule-exercise-modes"><summary>운동 종류 확인·수정 · 선택 사항</summary><p>제목에서 읽은 종류를 바꾸거나, 모호한 운동을 한 번만 선택해요. 같은 블록의 반복 일정에도 재사용해요.</p>{result.exerciseChoices.map(o=><div key={o.block.id}><ChoiceButtons label={`${o.block.title} 운동 종류`} value={exerciseMode(o,profile)} disabled={busy} options={{strength:"근력 위주",endurance:"유산소 위주",mixed:"둘 다",light:"가벼운 운동"}} onChange={v=>void save({...profile,exerciseModes:[...profile.exerciseModes.filter(x=>x.blockId!==(o.block.groupId??o.block.id)),{blockId:o.block.groupId??o.block.id,title:o.block.title,mode:v as NutritionProfile["exerciseModes"][number]["mode"]}].slice(-180)})}/></div>)}</details>}
    </>}
    {error&&<p role="alert" className="form-error">{error}</p>}
    <p className="schedule-nutrition-caption">일정은 영양 관리의 맥락이에요. 실제 식사·운동·영양소 부족을 확정하지 않으며, 일정 변경 시 안내도 다시 계산해요.</p>
    {onOpen&&<button type="button" className="text-link" onClick={onOpen}>식품·성분과 제품 선택 정보 보기 <ArrowRight size={14}/></button>}
  </>;
  return compact?<details className="panel schedule-nutrition schedule-nutrition-compact"><summary><Leaf size={18}/><span><b>일정에 맞춘 영양 가이드</b><small>{result.guides[0]?.title??"일정에서 식사와 활동 준비를 확인해요"}</small></span><ChevronDown size={16}/></summary><div className="schedule-nutrition-body">{rows}</div></details>:<section className="panel schedule-nutrition" aria-labelledby={heading}><header><span className="eyebrow">PLAN → NUTRITION</span><h3 id={heading}><CalendarDays size={18}/> {date} 일정에 맞춘 영양 가이드</h3><p>먼저 일정으로 안내하고, 원할 때 필요한 질문만 확인해요.</p></header>{rows}</section>;
}

function GuideCard({guide:g,busy,active,onExpand,onAnswer,onInspect}:{guide:ScheduleGuide;busy:boolean;active:boolean;onExpand:()=>void;onAnswer:(v:"possible"|"difficult"|"unknown")=>void;onInspect?: (id:string)=>void}){
  const panelId=useId();
  return <article className="schedule-guide-card"><span className="schedule-guide-nutrient">{g.nutrient}</span><h4>{g.title}</h4><p>{g.benefit}</p><details><summary>일정에서 발견한 이유와 준비 방법</summary><p>{g.reason}</p><p>{g.action}</p></details>
    {g.question&&<><button type="button" className="text-link" aria-expanded={active} aria-controls={panelId} onClick={onExpand}>{g.answer?"답변 확인·수정":"추천 구체화 · 질문 1개"}<ChevronDown size={14}/></button><div id={panelId} hidden={!active}><ChoiceButtons label={g.question.title} value={g.answer??""} options={g.question.options} disabled={busy} onChange={v=>onAnswer(v as "possible"|"difficult"|"unknown")}/></div></>}
    {g.feedback&&<p className="schedule-guide-feedback" role="status">{g.feedback}</p>}
    {g.ingredientIds.length>0&&onInspect&&<div className="schedule-guide-actions">{g.ingredientIds.map(id=><button key={id} type="button" className="button secondary" onClick={()=>onInspect(id)}>{id==="protein"?"단백질 식품·보충 방법":"크레아틴 기능·적합성 확인"}<ArrowRight size={13}/></button>)}</div>}
    <details className="schedule-guide-source"><summary>참고 자료</summary><a href={g.source} target="_blank" rel="noopener noreferrer">{g.sourceTitle}</a><p>성분의 일반 기능과 적용 범위를 확인한 자료예요. 일정 분석 규칙이나 개인의 부족 여부를 검증한 연구는 아니에요.</p></details>
  </article>;
}
