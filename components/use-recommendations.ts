"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import type { AppState } from "@/lib/model";
import { applyRecommendationRequest,recommendationMemory,syncRecommendationState } from "@/lib/recommendation-learning";
import { emptyRecommendationDocument,emptyRecommendationMemory,type RecommendationEvent,type RecommendationIntent,type RecommendationMemory,type RecommendationRequest } from "@/lib/recommendation-model";

export function useRecommendations(app:AppState|null,demo:boolean){
  const [memory,setMemory]=useState<RecommendationMemory>(emptyRecommendationMemory),[error,setError]=useState("");
  const live=useRef({app,demo});live.current={app,demo};const doc=useRef(emptyRecommendationDocument()),seen=useRef(new Set<string>()),queue=useRef<RecommendationEvent[]>([]),timer=useRef<ReturnType<typeof setTimeout>|null>(null),epoch=useRef(0);
  const refresh=useCallback(async()=>{if(!live.current.app||live.current.demo)return;const version=epoch.current;try{const r=await fetch("/api/recommendations",{cache:"no-store"}),data=await r.json();if(!r.ok)throw Error(data.error??"추천 이력을 불러오지 못했어요.");if(version===epoch.current){setMemory(old=>old.revision>data.memory.revision?old:data.memory);setError("");}}catch(e){if(version===epoch.current)setError((e as Error).message);}},[]);
  const enabled=!!app;
  useEffect(()=>{epoch.current++;seen.current.clear();queue.current=[];if(timer.current)clearTimeout(timer.current);doc.current=emptyRecommendationDocument();setMemory(emptyRecommendationMemory());setError("");if(enabled&&!demo)void refresh();return()=>{if(timer.current)clearTimeout(timer.current);};},[enabled,demo,refresh]);
  async function send(events:RecommendationEvent[],version:number,attempt=0){
    if(version!==epoch.current||live.current.demo)return;
    try{const r=await fetch("/api/recommendations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"events",events})}),data=await r.json();if(!r.ok)throw Error(data.error??"관심 기록을 저장하지 못했어요.");if(version===epoch.current){setMemory(old=>old.revision>data.memory.revision?old:data.memory);setError("");}}
    catch(e){if(version!==epoch.current)return;if(attempt<2)setTimeout(()=>void send(events,version,attempt+1),1000*(attempt+1));else setError((e as Error).message);}
  }
  function track(event:RecommendationEvent){
    if(!live.current.app)return;const key=`${event.date}:${event.routineId}:${event.kind}`;if(seen.current.has(key))return;seen.current.add(key);
    if(live.current.demo){applyRecommendationRequest(doc.current,live.current.app,{action:"events",events:[event]});setMemory(recommendationMemory(doc.current));return;}
    queue.current.push(event);if(timer.current)return;timer.current=setTimeout(()=>{timer.current=null;const events=queue.current.splice(0);for(let i=0;i<events.length;i+=25)void send(events.slice(i,i+25),epoch.current);},300);
  }
  async function change(request:RecommendationRequest){
    if(!live.current.app)throw Error("기초 질문을 먼저 저장해주세요.");
    if(live.current.demo){applyRecommendationRequest(doc.current,live.current.app,request);setMemory(recommendationMemory(doc.current));return;}
    const r=await fetch("/api/recommendations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(request)}),data=await r.json();if(!r.ok)throw Error(data.error??"추천 설정을 저장하지 못했어요.");setMemory(old=>old.revision>data.memory.revision?old:data.memory);setError("");
  }
  function saved(before:AppState|null,after:AppState,intent?:RecommendationIntent){if(live.current.demo){syncRecommendationState(doc.current,before,after,intent);setMemory(recommendationMemory(doc.current));}else void refresh();}
  return {memory,error,track,change,saved,refresh,clear:()=>{epoch.current++;doc.current=emptyRecommendationDocument();setMemory(emptyRecommendationMemory());seen.current.clear();queue.current=[];}};
}
