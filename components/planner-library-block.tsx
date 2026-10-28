"use client";
import { useState, type CSSProperties } from "react";
import { ChevronDown, GripVertical, MoreHorizontal, Pencil, Plus } from "lucide-react";
import type { PlannerTemplate } from "@/lib/planner-model";
import { durationOf } from "@/lib/planner";

export function PlannerLibraryBlock({ template: t, style, busy, active, onPlace, onEdit, onRemove, onDrag }: {
  template: PlannerTemplate; style: CSSProperties; busy: boolean; active: boolean;
  onPlace: () => void; onEdit: () => void; onRemove: () => void; onDrag: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return <article className={`sp-template ${active ? "is-placing" : ""}`} style={style} draggable={!busy}
    onDragStart={e => { e.dataTransfer.setData("application/x-routinefit-template", t.id); e.dataTransfer.effectAllowed = "copy"; onDrag(t.id); }} onDragEnd={() => onDrag(null)}>
    <div className="sp-template-row"><button className="sp-template-place" disabled={busy} onClick={onPlace} aria-label={`${t.title} 시간대 선택`} aria-pressed={active} title="시간표에서 배치할 시간 선택"><GripVertical size={14}/><b>{t.title}</b></button>
      <button className="sp-template-disclosure" disabled={busy} aria-expanded={open} aria-label={`${t.title} 상세 정보 ${open ? "접기" : "펼치기"}`} onClick={() => setOpen(!open)}><ChevronDown size={14}/></button></div>
    {open && <div className="sp-template-body"><p>{durationOf(t)}분{t.location ? ` · ${t.location}` : ""}</p><small>정신 {t.mental}/5 · 육체 {t.physical}/5</small><footer><button className="text-link" disabled={busy} onClick={onPlace}>배치 <Plus size={13}/></button><button className="text-link" disabled={busy} aria-label={`${t.title} 원본 및 전체 일정 수정`} onClick={onEdit}><Pencil size={13}/>수정</button><button className="icon-button" disabled={busy} aria-label={`${t.title} 전체 일정에서 제거`} title="전체 일정에서 제거" onClick={onRemove}><MoreHorizontal size={16}/></button></footer></div>}
  </article>;
}
