"use client";
import { contentInterests,type ContentInterest } from "@/lib/media";

export function ContentInterestChoices({value,onChange,disabled=false}:{value:ContentInterest[];onChange:(value:ContentInterest[])=>void;disabled?:boolean}){
  return <fieldset className="media-choices content-interests" disabled={disabled}>
    <legend>현재 관심사 · 여러 개 선택</legend>
    <div>{contentInterests.map(c=><button type="button" key={c.id} disabled={disabled} aria-pressed={value.includes(c.id)} onClick={()=>onChange(value.includes(c.id)?value.filter(v=>v!==c.id):[...value,c.id])}>{c.label}</button>)}</div>
    <div className="content-interest-meta"><p className="question-small">{value.length?`${value.length}개 선택 · 같은 버튼을 다시 누르면 해제돼요.`:"선택하지 않아도 계속할 수 있어요."}</p>
    <button type="button" className="text-link" onClick={()=>onChange([])} disabled={!value.length||disabled}>관심사 선택 지우기</button></div>
  </fieldset>;
}
