"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import type { AppState } from "@/lib/model";
import { applyPetCommand } from "@/lib/pet-actions";
import { calculatePet } from "@/lib/pet-engine";
import type { PetCommand,PetResult } from "@/lib/pet-model";
import type { SleepRecord } from "@/lib/sleep";

type Result=PetResult&{app?:AppState};
export function usePetCompanion(app:AppState|null,revision:number,demo:boolean,onApp:(app:AppState,revision:number)=>void){
  const [result,setResult]=useState<Result|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false);
  const current=useRef({app,revision,demo,onApp,result});current.current={app,revision,demo,onApp,result};
  const retry=useRef<{body:string;key:string}|null>(null),generation=useRef(0);
  const demoSleep=useRef<SleepRecord[]>([]);
  const enabled=!!app;
  const reload=useCallback(async()=>{
    const c=current.current;if(!c.app)return;
    if(c.demo){setResult(old=>old?.document?{...old,view:calculatePet(old.document)}:old);return;}
    const version=generation.current;
    try{
      const response=await fetch("/api/pet",{cache:"no-store"});const data=await response.json();
      if(!response.ok)throw Error(data.error??"강아지 기록을 불러오지 못했어요.");
      if(version!==generation.current)return;
      if(data.appRevision!==current.current.revision){const res=await fetch("/api/state",{cache:"no-store"}),fresh=await res.json();if(!res.ok)throw Error(fresh.error??"최신 기록을 불러오지 못했어요.");if(version!==generation.current)return;if(fresh.state&&fresh.revision>=current.current.revision)current.current.onApp(fresh.state,fresh.revision);}
      setResult(old=>old&&old.revision>data.revision?old:data);setError("");
    }catch(e){if(version===generation.current)setError((e as Error).message);}
  },[]);
  useEffect(()=>{generation.current++;setResult(null);setError("");retry.current=null;if(!enabled||demo)return;setLoading(true);void reload().finally(()=>setLoading(false));},[enabled,demo,reload]);
  useEffect(()=>{if(!enabled)return;const wake=()=>{if(document.visibilityState==="visible")void reload();};window.addEventListener("focus",wake);document.addEventListener("visibilitychange",wake);const timer=setInterval(wake,60000);return()=>{clearInterval(timer);window.removeEventListener("focus",wake);document.removeEventListener("visibilitychange",wake);};},[enabled,reload]);
  async function mutate(command:PetCommand){
    const c=current.current;if(!c.app)throw Error("기초 질문을 먼저 저장해주세요.");
    const body=JSON.stringify(command),key=retry.current?.body===body?retry.current.key:crypto.randomUUID();retry.current={body,key};
    const input={key,command,revision:c.result?.revision??0,appRevision:c.revision};
    if(c.demo){const next=applyPetCommand(c.result?.document??null,c.app,input,new Date(),demoSleep.current);const data={...next,view:calculatePet(next.document),revision:input.revision+1,appRevision:c.revision+1};setResult(data);c.onApp(next.app,data.appRevision);retry.current=null;return data;}
    const res=await fetch("/api/pet",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}),data=await res.json();
    if(!res.ok){if(res.status===409){retry.current=null;await reload();}throw Error(data.error??"실천 기록을 저장하지 못했어요.");}
    setResult(data);if(data.app)c.onApp(data.app,data.appRevision);retry.current=null;setError("");return data as Result;
  }
  async function updateSleep(records:SleepRecord[]){
    if(!current.current.demo){await reload();return;}
    demoSleep.current=records;
    const old=current.current.result;if(!old?.document)return;const doc=structuredClone(old.document);
    for(const r of doc.records.filter(r=>!r.cancelled&&r.type==="sleep")){
      const source=r.sources.find(s=>s.kind==="sleep");if(!source)continue;
      const start=records.find(s=>s.kind==="bed"&&s.sessionDate===source.date)?.actualAt,end=records.find(s=>s.kind==="wake"&&s.sessionDate===source.date)?.actualAt;
      if(!start||!end){r.cancelled=true;continue;}
      if(start>=end||doc.records.some(other=>!other.cancelled&&other.id!==r.id&&other.type!=="meal"&&other.start<end&&other.end>start))throw Error("수면 실제 구간이 다른 활동과 겹쳐요. 시각을 다시 확인해주세요.");
      r.start=start;r.end=end;
    }
    setResult({...old,document:doc,view:calculatePet(doc),revision:old.revision+1});
  }
  return {result,error,loading,reload,mutate,updateSleep,clear:()=>{setResult(null);retry.current=null;demoSleep.current=[];}};
}
