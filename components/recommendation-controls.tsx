"use client";
import { useEffect,useRef,useState } from "react";
import { localDate } from "@/lib/model";
import type { RecommendationEvent,RecommendationMemory,RecommendationRequest } from "@/lib/recommendation-model";

export function RecommendationVisibility({routineId,date,kind,onEvent}:{routineId:string;date:string;kind:"catalog_view"|"recommendation_view";onEvent?:(e:RecommendationEvent)=>void}){
  const marker=useRef<HTMLSpanElement>(null),callback=useRef(onEvent);callback.current=onEvent;
  useEffect(()=>{
    const card=marker.current?.parentElement;if(!card||!callback.current||date!==localDate())return;
    let timer:ReturnType<typeof setTimeout>|undefined,done=false;const clear=()=>{if(timer)clearTimeout(timer);timer=undefined;};
    const observer=new IntersectionObserver(([entry])=>{clear();if(!done&&entry.intersectionRatio>=.5&&document.visibilityState==="visible")timer=setTimeout(()=>{if(document.visibilityState!=="visible"||document.querySelector("dialog[open]"))return;done=true;callback.current?.({kind,date,routineId});observer.disconnect();},1000);},{threshold:[.5]});
    const visibility=()=>{clear();if(!done&&document.visibilityState==="visible"){observer.unobserve(card);observer.observe(card);}};observer.observe(card);document.addEventListener("visibilitychange",visibility);document.addEventListener("close",visibility,true);
    return()=>{clear();observer.disconnect();document.removeEventListener("visibilitychange",visibility);document.removeEventListener("close",visibility,true);};
  },[routineId,date,kind]);
  return <span ref={marker} hidden aria-hidden="true"/>;
}
export function RecommendationSettings({memory,error,busy,onChange}:{memory:RecommendationMemory;error:string;busy:boolean;onChange:(v:RecommendationRequest)=>Promise<void>}){
  const [failure,setFailure]=useState(""),[saving,setSaving]=useState(false),[notice,setNotice]=useState("");
  const change=async(v:RecommendationRequest)=>{if(saving)return;setSaving(true);setFailure("");try{await onChange(v);setNotice("추천 설정을 저장했어요. 다음 루틴 생성부터 반영돼요.");}catch(e){setFailure((e as Error).message);}finally{setSaving(false);}};
  return <section className="panel"><h2>나에게 맞춰 배우는 추천</h2><p>실제로 본 추천, 찾아본 루틴과 실천·제외 기록을 반영해요. 시간 부족·몸 상태로 건너뛴 반응은 비선호와 구분해요.</p><fieldset><legend>한 번에 받을 자동 추천</legend><div className="choice-buttons">{([3,4,5] as const).map(count=><button key={count} aria-pressed={memory.count===count} disabled={busy||saving} onClick={()=>void change({action:"settings",count})}>{count}개</button>)}</div></fieldset><p className="muted">직접 추가·완료한 루틴은 보존해요. 시간·조건이 부족하면 가능한 개수만 추천해요.</p><details><summary>추천에서 제외한 루틴 ({memory.blocked.length})</summary>{memory.blocked.map(item=><div className="recommendation-blocked" key={item.id}><span>{item.title}</span><button className="text-link" disabled={busy||saving} onClick={()=>void change({action:"unblock",canonicalId:item.id})}>다시 추천 허용</button></div>)}{!memory.blocked.length&&<p>영구 제외한 루틴이 없어요.</p>}</details><details><summary>개인화 기준과 기록</summary><p>오늘의 적합도 45%, 실천 성향 40%, 관심 성향 15%를 기본으로 사용해요. 제외 이력과 반복 노출을 조정하고 적합한 새 후보도 일부 비교해요.</p><p>초기 실험 계수이며 추천 정확도를 보장하는 수치가 아니에요. 새로고침만으로 오늘 목록을 다시 뽑지 않아요. 추천 반응은 최근 90일을 학습하며 내 데이터 내보내기·전체 초기화에 포함돼요.</p></details>{(failure||error)&&<p className="form-error" role="alert">{failure||error}</p>}{notice&&<p role="status">{notice}</p>}</section>;
}
