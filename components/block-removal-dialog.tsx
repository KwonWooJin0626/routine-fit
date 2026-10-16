"use client";
import { useState } from "react";
import { Trash2,Repeat2,CalendarDays,ShieldCheck } from "lucide-react";
import { type Planner,plannerCategories } from "@/lib/planner-model";
import { affectedBlock,removalCandidates,upcomingDates,type RemovalRequest,type RemovalScope,type RemovalTarget } from "@/lib/planner-removal";
import { localDate } from "@/lib/model";
import { weekdayNames } from "@/lib/planner";
import { Dialog,Input } from "./forms";

export function BlockRemovalDialog({planner,target,busy,onClose,onConfirm}:{planner:Planner;target:RemovalTarget;busy:boolean;onClose:()=>void;onConfirm:(r:RemovalRequest)=>Promise<void>}){
  const candidates=removalCandidates(planner,target),today=localDate();
  const [scope,setScope]=useState<RemovalScope>("future"),[blockIds,setBlockIds]=useState(candidates.linkedBlocks.map(b=>b.id)),[templateIds,setTemplateIds]=useState(candidates.linkedTemplates.map(t=>t.id));
  const [removeLibrary,setRemoveLibrary]=useState(false),[query,setQuery]=useState(target.item.title),[error,setError]=useState("");
  const request:RemovalRequest={scope,date:scope==="date"?target.date:today,blockIds,templateIds,removeLibrary};
  const affected=planner.blocks.filter(b=>affectedBlock(b,request)),fixed=affected.filter(b=>b.kind==="fixed").length,once=affected.length-fixed;
  const templateCount=removeLibrary?planner.templates.filter(t=>templateIds.includes(t.id)).length:0;
  const legacyBlocks=planner.blocks.filter(b=>!b.groupId&&!candidates.linkedBlocks.some(x=>x.id===b.id)&&(`${b.title} ${b.location} ${plannerCategories[b.category]}`).includes(query.trim()));
  const legacyTemplates=planner.templates.filter(t=>!t.groupId&&!candidates.linkedTemplates.some(x=>x.id===t.id)&&(`${t.title} ${plannerCategories[t.category]}`).includes(query.trim()));
  const toggle=(ids:string[],id:string,checked:boolean)=>checked?[...new Set([...ids,id])]:ids.filter(x=>x!==id);
  const submit=async()=>{setError("");if(!affected.length&&!templateCount){setError("제거할 일정이나 보관함 블록을 선택해주세요.");return;}try{await onConfirm(request);}catch(e){setError((e as Error).message);}};
  const blockRows=(rows:typeof planner.blocks,legacy=false)=><div className="sp-removal-rows">{rows.map(b=><label className="sp-removal-row" key={b.id}><input type="checkbox" checked={blockIds.includes(b.id)} onChange={e=>setBlockIds(toggle(blockIds,b.id,e.target.checked))}/><span>{b.kind==="fixed"?<Repeat2 size={16}/>:<CalendarDays size={16}/>}</span><div><b>{b.title}</b><small>{plannerCategories[b.category]} · {b.start}–{b.end}{b.end<=b.start?" (다음 날 종료)":""} · {b.location||"장소 없음"}</small><small>{b.kind==="fixed"?`매주 ${b.weekdays.map(d=>weekdayNames[d]).join("·")} · ${b.date}부터${b.until?` ${b.until}까지`:""}`:b.date}{legacy?" · 연결 정보 없음":" · 원본 연결 확인"}</small><small>{scope==="date"?(affectedBlock(b,{...request,blockIds:[b.id]})?`${target.date} 일정 제거`:"이 날짜에는 일정 없음"):scope==="future"?(upcomingDates(b,today).length?`예정 날짜: ${upcomingDates(b,today).join(", ")}${b.kind==="fixed"?" …":""}`:"오늘 이후 예정 일정 없음"):"이 블록의 모든 계획표 배치 제거"}</small></div></label>)}</div>;
  const templateRows=(rows:typeof planner.templates)=><div className="sp-removal-rows">{rows.map(t=><label className="sp-removal-row" key={t.id}><input type="checkbox" disabled={!removeLibrary} checked={templateIds.includes(t.id)} onChange={e=>setTemplateIds(toggle(templateIds,t.id,e.target.checked))}/><div><b>{t.title}</b><small>{plannerCategories[t.category]} · 보관함 {t.groupId?"원본 연결 확인":"연결 정보 없음"}</small></div></label>)}</div>;
  return <Dialog title={`‘${target.item.title}’ 블록 제거`} subtitle="주간·하루 계획에서 제거할 범위와 대상을 확인해주세요." onClose={()=>{if(!busy)onClose();}} wide><form onSubmit={e=>{e.preventDefault();void submit();}}>
    <fieldset className="sp-removal-scopes"><legend>어디에서 제거할까요?</legend>{([['date',`선택한 날짜(${target.date})에서만 제거`],['future',`오늘(${today}) 이후의 모든 일정에서 제거`],['all','과거를 포함한 모든 계획표에서 제거']] as const).map(([value,label])=><label key={value}><input type="radio" name="block-removal-scope" value={value} checked={scope===value} onChange={()=>setScope(value)}/><span>{label}</span></label>)}</fieldset>
    <section className="sp-removal-section"><h3>연결된 일정 확인</h3>{blockRows(candidates.linkedBlocks)}{!candidates.linkedBlocks.length&&<p>원본 연결이 확인된 일정이 없어요. 아래에서 기존 일정을 직접 확인해 선택할 수 있어요.</p>}</section>
    <label className="check-choice sp-removal-library"><input type="checkbox" checked={removeLibrary} onChange={e=>setRemoveLibrary(e.target.checked)}/>보관함에서도 함께 제거</label>{removeLibrary&&templateRows(candidates.linkedTemplates)}
    <details className="optional-questions sp-removal-legacy" open={candidates.linkedBlocks.length===0}><summary>연결 정보가 없는 기존 블록 직접 선택</summary><p>제목이 같아도 같은 블록으로 단정하지 않아요. 날짜·시간·장소를 확인하고 필요한 항목만 직접 선택하세요. 검색어를 비우면 다른 이름의 기존 블록도 볼 수 있어요.</p><Input label="기존 블록 검색" value={query} onChange={setQuery} placeholder="블록 이름 또는 장소"/>{blockRows(legacyBlocks,true)}{removeLibrary&&templateRows(legacyTemplates)}{!legacyBlocks.length&&(!removeLibrary||!legacyTemplates.length)&&<p>검색한 기존 블록이 없어요.</p>}</details>
    <p className="text-small muted">날짜 범위는 블록이 시작하는 날짜 기준입니다. 전날 시작해 자정을 넘는 일정은 전날 일정으로 처리해요.</p><div className="sp-removal-summary" role="status"><strong>제거 예정: 반복 계획 {fixed}개 · 개별 배치 {once}개 · 보관함 {templateCount}개</strong><p>반복 계획은 반복 규칙의 개수이며, 무기한 반복되는 날짜 수를 뜻하지 않아요.</p></div>
    <div className="note"><ShieldCheck size={18}/><div>완료·부분 완료·건너뜀 등 건강 루틴 실천 기록은 지우지 않아요. 오늘 일정이 바뀌면 미완료 자동 추천을 조정합니다. 제거 후 이 화면에서 ‘되돌리기’로 복원할 수 있어요. 새로고침하거나 화면을 벗어나면 되돌리기 정보는 사라져요.</div></div>
    {error&&<p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>취소</button><button className="button danger" disabled={busy||(!affected.length&&!templateCount)}><Trash2 size={16}/>{busy?"제거 중…":!affected.length&&templateCount?"보관함에서만 제거":"선택한 일정 제거"}</button></div>
  </form></Dialog>;
}
