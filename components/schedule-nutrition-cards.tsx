"use client";
import { useId } from "react";
import { ArrowRight,ArrowUpRight,CalendarDays,ChevronDown,Leaf,Plus } from "lucide-react";
import type { AppState } from "@/lib/model";
import type { NutritionProfile } from "@/lib/nutrition-profile";
import { ingredients } from "@/lib/nutrition";
import { supplementSearch,supplementIngredientQuery } from "@/lib/supplement-journal";
import { scheduleNutrition,type ScheduleGuide } from "@/lib/schedule-nutrition";
type Props={state:AppState;date:string;busy:boolean;compact?:boolean;onSave:(p:NutritionProfile)=>Promise<void>;onInspect?:(id:string)=>void;onOpen?:()=>void;onPlan?:()=>void;onRegister?:(id:string)=>void};
export function scheduleCandidateLinks(g:ScheduleGuide,state:AppState){
  return g.ingredientIds.flatMap(id=>{const i=ingredients.find(i=>i.id===id);if(!i)return [];
    let query=supplementIngredientQuery(id,i.query,state),label=i.name;
    if(id==="protein"&&(state.nutrition?.allergens.includes("milk")||state.nutrition?.proteinSource==="plant"||state.answers.diet==="vegan")){query=state.nutrition?.allergens.includes("soy")?"rice protein":"plant protein";label="식물성 단백질";}
    else if(id==="protein"&&state.nutrition?.lactose==="discomfort"){query="whey protein isolate lactose free";label="유당 표시 확인 단백질";}
    if(id==="lutein")label="루테인·지아잔틴";
    return [{id,label,url:supplementSearch(query)}];
  });
}
export function ScheduleNutrition({state,date,busy,compact=false,onInspect,onOpen,onPlan,onRegister}:Props){
  const heading=useId(),result=scheduleNutrition(state,date);if(!state.answers.supplementOptIn)return null;
  const rows=<>{!result.hasSchedule?<div className="schedule-nutrition-empty"><p>일정이 아직 없어요. 일정을 담으면 활동에 맞는 영양 가이드를 먼저 보여드려요.</p>{onPlan&&<button className="button secondary" onClick={onPlan}>계획표에 일정 담기<ArrowRight size={14}/></button>}</div>:<><div className="schedule-nutrition-meta"><span>{date} · 등록된 계획 기준</span>{result.exerciseMinutes>0&&<span>운동 예정 {result.exerciseMinutes}분 · 최근 7일 {result.weeklyExerciseDays}일</span>}</div>{!result.guides.length&&<p>현재 일정에서는 평소 식사와 휴식을 챙겨요.</p>}<div className="schedule-nutrition-list">{result.guides.slice(0,3).map(g=><GuideCard key={g.id} guide={g} state={state} busy={busy} onInspect={onInspect} onRegister={onRegister}/>)}</div>{result.guides.length>3&&<details className="schedule-nutrition-more"><summary>다른 일정 가이드 {result.guides.length-3}개</summary><div className="schedule-nutrition-list">{result.guides.slice(3).map(g=><GuideCard key={g.id} guide={g} state={state} busy={busy} onInspect={onInspect} onRegister={onRegister}/>)}</div></details>}</>}
    <p className="schedule-nutrition-caption">추가 질문 없이 기존 정보를 활용해요. iHerb는 성분 검색 연결이며 특정 상품의 적합성·가격·재고를 확인한 추천은 아니에요.</p>{onOpen&&<button className="text-link" onClick={onOpen}>식품·성분 정보 보기<ArrowRight size={14}/></button>}</>;
  return compact?<details className="panel schedule-nutrition schedule-nutrition-compact"><summary><Leaf size={18}/><span><b>일정에 맞춘 영양 가이드</b><small>{result.guides[0]?.title??"일정에서 식사와 활동 준비를 확인해요"}</small></span><ChevronDown size={16}/></summary><div className="schedule-nutrition-body">{rows}</div></details>:<section className="panel schedule-nutrition" aria-labelledby={heading}><header><h3 id={heading}><CalendarDays size={18}/>계획표에서 챙길 영양 관리</h3><p>일정과 저장된 정보로 먼저 제안해요.</p></header>{rows}</section>;
}
function GuideCard({guide:g,state,busy,onInspect,onRegister}:{guide:ScheduleGuide;state:AppState;busy:boolean;onInspect?:(id:string)=>void;onRegister?:(id:string)=>void}){
  const links=scheduleCandidateLinks(g,state);
  return <article className="schedule-guide-card"><span className="schedule-guide-nutrient">{g.nutrient}</span><h4>{g.title}</h4><p>{g.benefit}</p>{links.length>0&&<div className="schedule-direct-links">{links.map(link=><div key={link.id}><a className="button secondary" href={link.url} target="_blank" rel="noopener noreferrer">{link.label} · iHerb에서 보기<ArrowUpRight size={14}/></a>{onRegister&&<button className="text-link" disabled={busy} onClick={()=>onRegister(link.id)}><Plus size={12}/>복용 계획에 등록</button>}</div>)}</div>}<details><summary>추천 이유·식품·연구 적용 범위</summary><p>{g.reason}</p><p>{g.action}</p>{onInspect&&links.map(link=><button key={link.id} className="text-link" onClick={()=>onInspect(link.id)}>{link.label} 식품·성분 상세<ArrowRight size={12}/></button>)}<a href={g.source} target="_blank" rel="noopener noreferrer">{g.sourceTitle}</a><p>일정 분석 규칙은 추천 맥락을 고르는 서비스 기준이며 개인의 결핍을 진단한 값이 아니에요. 검색·구매로 복용 완료가 기록되지 않아요.</p></details></article>;
}
