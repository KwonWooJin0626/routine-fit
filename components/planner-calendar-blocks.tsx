"use client";
import { useState,type CSSProperties } from "react";
import { Check,Repeat2,TriangleAlert } from "lucide-react";
import { calendarSegments,type CalendarSegment } from "@/lib/planner-overlap";
import { plannerCategories,plannerColors,type Planner,type PlannerBlock } from "@/lib/planner-model";
import type { CalendarRow } from "@/lib/planner-grid";
import { toTime } from "@/lib/model";
import { Dialog } from "./forms";
import type { PlannerMark } from "./schedule-workspace";

export function segmentRect(rows:CalendarRow[],from:number,until:number){
  const slots=rows.filter(r=>r.kind==="slot"&&r.from<until&&r.until>from);if(!slots.length)return null;
  const first=slots[0],last=slots.at(-1)!;
  const top=first.top+(Math.max(from,first.from)-first.from)*.8;
  return {top,height:last.top+(Math.min(until,last.until)-last.from)*.8-top};
}
export function PlannerCalendarBlocks({planner,date,today,rows,busy,selecting,onEdit,onMark,onCompleteTodo}:{planner:Planner;date:string;today:string;rows:CalendarRow[];busy:boolean;selecting:boolean;onEdit:(b:PlannerBlock,date:string)=>void;onMark:(b:PlannerBlock,date:string,status:PlannerMark)=>void;onCompleteTodo:(id:string)=>void}){
  const [opened,setOpened]=useState<{from:number;until:number}|null>(null);
  const segments=calendarSegments(planner,date),active=opened?segments.find(s=>s.from===opened.from&&s.until===opened.until&&s.occurrences.length>1):undefined;
  return <>{segments.map(s=>{
    const rect=segmentRect(rows,s.from,s.until);if(!rect)return null;
    const o=s.occurrences[0],b=o.block,done=planner.records?.some(r=>r.blockId===b.id&&r.date===o.date&&r.status==="done");
    if(s.occurrences.length>1)return <div className="sp-overlap-wrap" key={`${s.from}-${s.until}`} style={{...rect,left:0,right:0}} onPointerDown={e=>{if(!selecting)e.stopPropagation();}}>
      <button type="button" className="sp-overlap-cell" disabled={busy||selecting} aria-label={`${date} ${toTime(s.from)}–${toTime(s.until)} 겹친 일정 ${s.occurrences.length}개`} onClick={()=>setOpened({from:s.from,until:s.until})}>
        <strong>{b.title} 외 {s.occurrences.length-1}개</strong>{rect.height>=40&&<small>{toTime(s.from)}–{s.until===1440?"24:00":toTime(s.until)} · 시간 겹침</small>}<span className="sp-overlap-corner" aria-hidden="true">{s.occurrences.length}</span>
      </button><div className="sp-overlap-preview" role="tooltip"><b>겹친 일정 {s.occurrences.length}개</b>{s.occurrences.map(x=><span key={`${x.block.id}:${x.date}`}>{x.block.title} · {x.block.start}–{x.block.end}</span>)}<small>눌러서 완료·수정하기</small></div>
    </div>;
    const style={"--block-hue":plannerColors[b.category],"--block-sat":`${35+b.shade*15}%`,"--block-light":`${98-b.shade*4}%`,...rect,left:0,right:0} as CSSProperties;
    return <div key={`${s.from}-${s.until}`} className={`sp-event ${b.kind} ${done?"is-done":""}`} style={style} onPointerDown={e=>{if(!selecting)e.stopPropagation();}}>
      <button type="button" className="sp-event-complete" disabled={busy||selecting||o.date>today} aria-pressed={done} aria-label={`${b.title} ${o.date} ${done?"완료 취소":"일정 완료"}`} onClick={()=>onMark(b,o.date,done?"clear":"done")}>{done?<Check size={13}/>:<span/>}</button>
      <button type="button" className="sp-event-open" disabled={selecting} onClick={()=>onEdit(b,o.date)} aria-label={`${b.title} ${b.start}–${b.end} ${b.location} 수정`}><strong>{b.kind==="fixed"&&<Repeat2 size={10}/>} {b.title}</strong>{rect.height>=32&&<small>{b.start}–{b.end}{o.date!==date?" · 전날 시작":""}</small>}{s.until-s.from>=60&&<span>{b.location||plannerCategories[b.category]}</span>}{s.until-s.from>=90&&<em>정신 {b.mental} · 육체 {b.physical}</em>}</button>
    </div>;
  })}{active&&<OverlapDialog segment={active} date={date} today={today} planner={planner} busy={busy} onClose={()=>setOpened(null)} onEdit={(b,d)=>{setOpened(null);onEdit(b,d);}} onMark={(b,d,status)=>{setOpened(null);onMark(b,d,status);}} onCompleteTodo={onCompleteTodo}/>}</>;
}
export function OverlapDialog({segment,date,today,planner,busy,onClose,onEdit,onMark,onCompleteTodo}:{segment:CalendarSegment;date:string;today:string;planner:Planner;busy:boolean;onClose:()=>void;onEdit:(b:PlannerBlock,date:string)=>void;onMark:(b:PlannerBlock,date:string,status:PlannerMark)=>void;onCompleteTodo:(id:string)=>void}){
  return <Dialog title="겹친 일정 메모" subtitle={`${date} ${toTime(segment.from)}–${segment.until===1440?"24:00":toTime(segment.until)} · 일정 ${segment.occurrences.length}개`} onClose={onClose}>
    <p className="sp-overlap-note"><TriangleAlert size={17}/>같은 시간에 등록된 일정이에요. 각 일정을 확인하거나 이대로 유지할 수 있어요.</p>
    <div className="sp-overlap-items">{segment.occurrences.map(o=>{
      const b=o.block,record=planner.records?.find(r=>r.blockId===b.id&&r.date===o.date),todo=planner.todos?.find(t=>t.id===b.todoId);
      return <article key={`${b.id}:${o.date}`}><div><button type="button" className="routine-check" disabled={busy||o.date>today} aria-label={`${b.title} 일정 ${record?.status==="done"?"완료 취소":"완료"}`} aria-pressed={record?.status==="done"} onClick={()=>onMark(b,o.date,record?.status==="done"?"clear":"done")}>{record?.status==="done"?<Check size={16}/>:<span/>}</button><div><b>{b.title}</b><p>{b.start}–{b.end} · {plannerCategories[b.category]}{o.date!==date?" · 전날 시작":""}</p></div></div><button type="button" className="button secondary" disabled={busy} onClick={()=>onEdit(b,o.date)}>세부 설정</button>{todo&&record?.status==="done"&&todo.status!=="done"&&<button type="button" className="text-link" disabled={busy} onClick={()=>onCompleteTodo(todo.id)}>할 일도 완료하기</button>}</article>;
    })}</div><div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose}>이대로 유지 · 닫기</button></div>
  </Dialog>;
}
