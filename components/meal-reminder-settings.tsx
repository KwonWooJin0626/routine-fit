"use client";
import { useEffect,useState } from "react";
import type { SleepProfile } from "@/lib/sleep-api";
import { Toggle } from "./forms";

type Settings={profile:SleepProfile|null;mealMailConfigured:boolean};
async function requestSettings(input?:{mealEmailEnabled:boolean;revision:number}){
  const response=await fetch("/api/sleep",input?{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}:{cache:"no-store"});
  const value=await response.json();
  if(!response.ok)throw Error(value.error??"식사 알림 설정을 불러오지 못했어요.");
  return value as Settings;
}

export function MealReminderSettings({demo}:{demo:boolean}){
  const [loaded,setLoaded]=useState<Settings|null>(null),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState("");
  useEffect(()=>{
    if(demo)return;
    let current=true;
    requestSettings().then(value=>{if(current){setLoaded(value);setEnabled(value.profile?.settings.mealEmailEnabled===true);}}).catch(e=>{if(current)setError(e.message);});
    return ()=>{current=false;};
  },[demo]);
  const saved=loaded?.profile?.settings.mealEmailEnabled===true;
  const canSend=loaded?.mealMailConfigured===true;
  async function save(){
    if(!loaded||busy||enabled===saved||enabled&&!canSend)return;
    setBusy(true);setError("");setMessage("");
    try{
      const next=await requestSettings({mealEmailEnabled:enabled,revision:loaded.profile?.revision??0});
      setLoaded({...loaded,profile:next.profile});
      setMessage(enabled?"식사 기록 메일을 켰어요.":"식사 기록 메일을 껐어요.");
    }catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <>
    <p>한국 시간 10:00~14:00, 17:00~21:00에 실제 식사 기록이 없으면 각 시간대가 끝난 뒤 안내 메일을 한 번 보냅니다.</p>
    {loaded&&(canSend||saved)&&<><Toggle label="식사 기록 알림 메일 받기" checked={enabled} onChange={value=>{if(!busy&&(!value||canSend))setEnabled(value);}}/>
      <button type="button" className="button primary" disabled={busy||enabled===saved||enabled&&!canSend} onClick={()=>void save()}>식사 알림 설정 저장</button></>}
    {demo?<p className="muted">로그인하면 식사 알림을 설정할 수 있어요.</p>:loaded&&!canSend?<p className="muted">인증된 이메일과 메일 발송 설정이 필요해요.</p>:!loaded&&!error?<p>설정을 불러오는 중이에요.</p>:null}
    {error&&<p role="alert" className="form-error">{error}</p>}
    {message&&<p role="status">{message}</p>}
  </>;
}
