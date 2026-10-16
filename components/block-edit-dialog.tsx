"use client";
import { useState } from "react";
import { Check,Link2,ShieldCheck } from "lucide-react";
import { type Planner,type PlannerBlock,plannerCategories } from "@/lib/planner-model";
import { removalCandidates,type RemovalTarget } from "@/lib/planner-removal";
import { blockContentSchema,type BlockContent,type BlockEditRequest } from "@/lib/planner-edit";
import { weekdayNames } from "@/lib/planner";
import { Dialog,Input,Select,Scale } from "./forms";

export function BlockEditDialog({planner,target,busy,onClose,onConfirm}:{planner:Planner;target:RemovalTarget;busy:boolean;onClose:()=>void;onConfirm:(r:BlockEditRequest)=>Promise<void>}){
  const candidates=removalCandidates(planner,target);
  const [v,set]=useState<BlockContent>(()=>blockContentSchema.parse(target.item));
  const [legacyIds,setLegacyIds]=useState<string[]>([]),[legacyTemplates,setLegacyTemplates]=useState<string[]>([]),[query,setQuery]=useState(target.item.title),[error,setError]=useState("");
  const change=<K extends keyof BlockContent>(key:K,value:BlockContent[K])=>set(old=>({...old,[key]:value}));
  const toggle=(ids:string[],id:string,checked:boolean)=>checked?[...new Set([...ids,id])]:ids.filter(x=>x!==id);
  const blockIds=[...candidates.linkedBlocks.map(b=>b.id),...legacyIds],templateIds=[...candidates.linkedTemplates.map(t=>t.id),...legacyTemplates];
  const legacyBlocks=planner.blocks.filter(b=>!b.groupId&&!candidates.linkedBlocks.some(x=>x.id===b.id)&&`${b.title} ${b.location} ${plannerCategories[b.category]}`.includes(query.trim()));
  const oldTemplates=planner.templates.filter(t=>!t.groupId&&!candidates.linkedTemplates.some(x=>x.id===t.id)&&`${t.title} ${plannerCategories[t.category]}`.includes(query.trim()));
  const submit=async()=>{setError("");const parsed=blockContentSchema.safeParse(v);if(!parsed.success){setError(parsed.error.issues[0].message);return;}try{await onConfirm({groupId:target.item.groupId??target.item.id,blockIds,templateIds,content:parsed.data});}catch(e){setError((e as Error).message);}};
  const row=(b:PlannerBlock)=><div><b>{b.title}</b><small>{b.kind==="fixed"?`매주 ${b.weekdays.map(d=>weekdayNames[d]).join("·")} · ${b.date}부터${b.until?` ${b.until}까지`:""}`:b.date} · {b.start}–{b.end} · {b.location||"장소 없음"}</small></div>;
  return <Dialog title="원본 블록과 연결된 전체 일정 수정" subtitle="과거·오늘·앞으로의 연결된 주간/하루 계획과 보관함을 함께 수정해요." onClose={()=>{if(!busy)onClose();}} wide><form onSubmit={e=>{e.preventDefault();void submit();}}>
    <div className="note"><Link2 size={18}/><div>아래 내용은 연결된 모든 일정에 똑같이 반영돼요. 각 일정의 날짜·시간·반복 요일·쉬는 시간은 유지해요. 시간 변경이나 하루만 수정은 시간표의 ‘일정 블록 수정’에서 할 수 있어요.</div></div>
    <div className="form-grid sp-edit-fields"><div className="form-span"><Input label="블록 제목" required value={v.title} onChange={x=>change("title",x.slice(0,60))}/></div><Select label="카테고리" value={v.category} options={plannerCategories} onChange={x=>change("category",x as BlockContent["category"])}/><Select label="블록 채도" value={String(v.shade)} options={{1:"은은하게",2:"보통",3:"선명하게"}} onChange={x=>change("shade",Number(x))}/><div className="form-span"><Input label="어디서 하나요?" value={v.location} onChange={x=>change("location",x.slice(0,100))}/></div><div className="form-span field"><label htmlFor="sp-edit-task">무엇을 하나요?</label><textarea id="sp-edit-task" maxLength={300} rows={3} value={v.task} onChange={e=>change("task",e.target.value)}/></div><Scale label="정신적 스트레스 정도" hint="1 편안함 · 5 매우 부담스러움 (내 예상)" value={v.mental} onChange={x=>change("mental",x)}/><Scale label="육체적 피로도" hint="1 거의 없음 · 5 매우 피곤함 (내 예상)" value={v.physical} onChange={x=>change("physical",x)}/></div>
    <section className="sp-removal-section"><h3>함께 수정되는 일정</h3><div className="sp-removal-rows">{candidates.linkedBlocks.map(b=><div className="sp-removal-row" key={b.id}><Link2 size={16}/>{row(b)}</div>)}{candidates.linkedTemplates.map(t=><div className="sp-removal-row" key={t.id}><Link2 size={16}/><div><b>{t.title}</b><small>카테고리 보관함 · {plannerCategories[t.category]}</small></div></div>)}</div></section>
    <details className="optional-questions sp-removal-legacy"><summary>연결 정보가 없는 기존 블록 추가 선택</summary><p>옛날에 만든 블록은 연결 정보가 없을 수 있어요. 이름만으로 자동 수정하지 않아요. 같은 원본에서 만든 항목만 직접 선택하세요. 선택한 항목은 이후에도 함께 수정돼요. 검색어를 비우면 다른 이름의 기존 블록도 표시돼요.</p><Input label="기존 블록 검색" value={query} onChange={setQuery}/><p>추가 선택: 일정 {legacyIds.length}개 · 보관함 {legacyTemplates.length}개</p><div className="sp-removal-rows">{legacyBlocks.map(b=><label className="sp-removal-row" key={b.id}><input type="checkbox" checked={legacyIds.includes(b.id)} onChange={e=>setLegacyIds(toggle(legacyIds,b.id,e.target.checked))}/>{row(b)}</label>)}{oldTemplates.map(t=><label className="sp-removal-row" key={t.id}><input type="checkbox" checked={legacyTemplates.includes(t.id)} onChange={e=>setLegacyTemplates(toggle(legacyTemplates,t.id,e.target.checked))}/><div><b>{t.title}</b><small>보관함 · {plannerCategories[t.category]}</small></div></label>)}</div>{!legacyBlocks.length&&!oldTemplates.length&&<p>검색한 기존 블록이 없어요.</p>}</details>
    <div className="sp-removal-summary" role="status"><strong>수정 예정: 반복 계획 {planner.blocks.filter(b=>blockIds.includes(b.id)&&b.kind==="fixed").length}개 · 개별 배치 {planner.blocks.filter(b=>blockIds.includes(b.id)&&b.kind==="once").length}개 · 보관함 {templateIds.length}개</strong><p>반복 계획의 개수는 날짜 수가 아닌 반복 규칙 수예요. 위 일정들의 내용이 ‘{v.title||"블록 제목"}’으로 변경돼요.</p></div>
    <div className="note"><ShieldCheck size={18}/><div>건강 루틴·완료 상태·메모는 보존해요. 오늘의 미완료 자동 추천은 새 일정 부담에 맞춰 조정하고, 과거 추천 루틴은 다시 만들지 않아요. 저장 후 이 화면에서 ‘되돌리기’가 가능해요. 화면을 벗어나거나 새로고침하면 되돌리기 정보가 사라져요.</div></div>
    {error&&<p className="form-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>취소</button><button className="button primary" disabled={busy||(!blockIds.length&&!templateIds.length)}><Check size={16}/>{busy?"수정 중…":"연결된 전체 일정에 적용"}</button></div>
  </form></Dialog>;
}
