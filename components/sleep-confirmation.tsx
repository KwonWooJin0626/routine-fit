"use client";
import { useState } from "react";
export function SleepConfirmation({token}:{token:string}){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const confirm=async()=>{setBusy(true);try{const res=await fetch("/api/sleep",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({kind:"wake",token})});const data=await res.json();if(!res.ok)throw Error(data.error);setMessage("체크인을 기록했어요. 실제 수면시간이나 기상 시각을 증명하는 기록은 아니에요.");}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}};
  return <section className="panel"><h1>수면 체크인을 남길까요?</h1><p>로그인한 계정과 메일의 확인 대상을 확인한 후, 버튼을 누른 시각을 기록해요.</p><button className="button primary" disabled={busy||!token||message.startsWith("체크인을 기록")} onClick={()=>void confirm()}>{busy?"저장 중…":"지금 체크인 확인"}</button>{message&&<p role="status">{message}</p>}<a className="text-link" href="/?view=sleep">웹에서 수면 기록 보기</a></section>;
}
