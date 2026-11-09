"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import type { AppState } from "@/lib/model";
import { applySupplementCommand,emptySupplementJournal,supplementJournalSchema,type SupplementCommand,type SupplementJournal } from "@/lib/supplement-journal";
export function useSupplementJournal(app:AppState|null,demo:boolean){
  const [journal,setJournal]=useState<SupplementJournal>(emptySupplementJournal),[revision,setRevision]=useState(0),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const current=useRef({app,demo,journal,revision});current.current={app,demo,journal,revision};
  const generation=useRef(0),saving=useRef(false),enabled=!!app;
  const reload=useCallback(async()=>{
    if(!current.current.app||current.current.demo)return;const version=generation.current;
    try{const res=await fetch("/api/supplements",{cache:"no-store"}),data=await res.json();if(!res.ok)throw Error(data.error??"복용 기록을 불러오지 못했어요.");const parsed=supplementJournalSchema.parse(data.journal);if(version===generation.current&&data.revision>=current.current.revision){current.current={...current.current,journal:parsed,revision:data.revision};setJournal(parsed);setRevision(data.revision);setError("");}}
    catch(e){if(version===generation.current)setError((e as Error).message);}
  },[]);
  useEffect(()=>{generation.current++;setJournal(emptySupplementJournal());setRevision(0);setError("");if(!enabled||demo)return;setLoading(true);void reload().finally(()=>setLoading(false));},[enabled,demo,reload]);
  useEffect(()=>{if(!enabled||demo)return;const wake=()=>{if(document.visibilityState==="visible"&&!saving.current)void reload();};window.addEventListener("focus",wake);document.addEventListener("visibilitychange",wake);return()=>{window.removeEventListener("focus",wake);document.removeEventListener("visibilitychange",wake);};},[enabled,demo,reload]);
  async function mutate(command:SupplementCommand){
    if(saving.current)throw Error("복용 기록 저장이 끝난 뒤 다시 시도해주세요.");const c=current.current;if(!c.app)throw Error("기초 프로필을 먼저 저장해주세요.");
    saving.current=true;setBusy(true);setError("");const version=generation.current;
    try{
      if(c.demo){const next=applySupplementCommand(c.journal,command,c.app);current.current={...current.current,journal:next,revision:c.revision+1};setJournal(next);setRevision(c.revision+1);return;}
      const res=await fetch("/api/supplements",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({revision:c.revision,command})}),data=await res.json();
      if(!res.ok){if(res.status===409)await reload();throw Error(data.error??"복용 기록을 저장하지 못했어요.");}
      if(version===generation.current){const parsed=supplementJournalSchema.parse(data.journal);current.current={...current.current,journal:parsed,revision:data.revision};setJournal(parsed);setRevision(data.revision);}
    }catch(e){setError((e as Error).message);throw e;}finally{saving.current=false;setBusy(false);}
  }
  return {journal,revision,loading,busy,error,reload,mutate,clear:()=>{generation.current++;setJournal(emptySupplementJournal());setRevision(0);setError("");}};
}
export type SupplementStore=ReturnType<typeof useSupplementJournal>;
