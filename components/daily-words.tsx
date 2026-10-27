"use client";
import { useState } from "react";
import { wordForDate } from "@/lib/daily-words";
import type { AppState } from "@/lib/model";

export function DailyWords({date,growth,busy,onSave}:{date:string;growth:AppState["growth"];busy:boolean;onSave:(g:NonNullable<AppState["growth"]>)=>Promise<void>}){
  const [period,setPeriod]=useState<"morning"|"evening">("morning"),[text,setText]=useState(growth?.reflections[date]??""),[error,setError]=useState("");
  const save=async(hideQuotes=false)=>{try{setError("");await onSave({hideQuotes,reflections:Object.fromEntries(Object.entries({...growth?.reflections,[date]:text.trim()}).sort(([a],[b])=>a.localeCompare(b)).slice(-90))});}catch(e){setError((e as Error).message);}};
  if(growth?.hideQuotes)return <button className="text-link" disabled={busy} onClick={()=>void save(false)}>하루의 시작·마무리 글귀 보기</button>;
  return <section className="daily-words panel" aria-label="하루의 시작과 마무리"><div className="daily-words-top"><div role="group" aria-label="글귀 시점"><button aria-pressed={period==="morning"} onClick={()=>setPeriod("morning")}>하루의 시작</button><button aria-pressed={period==="evening"} onClick={()=>setPeriod("evening")}>하루의 마무리</button></div><button className="text-link" disabled={busy} onClick={()=>void save(true)}>숨기기</button></div><blockquote>{wordForDate(date,period)}</blockquote><small>ROUTINE FIT 자체 작성 · {date}</small>{period==="evening"&&<div className="daily-reflection"><label htmlFor="daily-reflection">오늘 해낸 일 하나 남기기 (선택)</label><textarea id="daily-reflection" maxLength={300} rows={2} value={text} onChange={e=>setText(e.target.value)} placeholder="아주 작은 일이어도 좋아요."/><button className="button secondary" disabled={busy} onClick={()=>void save()}>회고 저장</button></div>}{error&&<p className="form-error" role="alert">{error}</p>}</section>;
}
