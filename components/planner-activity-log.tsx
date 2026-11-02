"use client";
import { CalendarCheck,Check,ArrowRight } from "lucide-react";
import type { Planner,PlannerBlock } from "@/lib/planner-model";
import type { PetDocument,PetExecution } from "@/lib/pet-model";
import { plannerActivitiesForDate,type PlannerActivity } from "@/lib/planner-activity";
import { executionMinutes } from "@/lib/pet-execution";
import { petTime } from "@/lib/pet-guidance";
import { occursOn } from "@/lib/planner";

export function PlannerActivityLog({planner,pet,date,busy,onPlan,onEdit,onConfirm}:{planner:Planner|undefined;pet:PetDocument|null|undefined;date:string;busy:boolean;onPlan:()=>void;onEdit:(r:PetExecution)=>void;onConfirm:(b:PlannerBlock,date:string)=>void}){
  const rows=plannerActivitiesForDate(planner,pet,date);
  const renderRow=(row:PlannerActivity)=><article key={row.key} className="planner-activity-row">
    <span className={`planner-activity-state ${row.status}`}><Check size={15}/>{row.status==="done"?"완료":"일부 수행"}</span>
    <div><h4>{row.title}</h4><p>{row.execution?row.execution.type==="meal"?`식사 기록 · ${petTime(row.execution.end)}`:`실제 ${Math.round(executionMinutes(row.execution))}분 · ${petTime(row.execution.start)} ~ ${petTime(row.execution.end)}`:`예정 ${row.start}–${row.end} · 실제 시간 미확인`}</p><small>{row.execution?"실제 수행 반영됨":"체크만 저장됨"}{row.date!==date?` · ${row.date}에 시작한 일정`:""}</small></div>
    {row.block&&occursOn(row.block,row.date)&&(row.execution?<button type="button" className="text-link" disabled={busy} onClick={()=>onEdit(row.execution!)}>수행 수정</button>:pet&&<button type="button" className="text-link" disabled={busy} onClick={()=>onConfirm(row.block!,row.date)}>실제 수행 확인</button>)}
  </article>;
  return <section className="planner-activity-log" aria-label="오늘 수행한 일정"><header><div><CalendarCheck size={18}/><h3>오늘 수행한 일정</h3><span>{rows.length}개</span></div><button type="button" className="text-link" onClick={onPlan}>계획표 보기<ArrowRight size={13}/></button></header>
    {rows.length?<><div>{rows.slice(0,3).map(renderRow)}</div>{rows.length>3&&<details><summary>나머지 {rows.length-3}개 보기</summary>{rows.slice(3).map(renderRow)}</details>}</>:<p className="planner-activity-empty">계획표에서 완료하거나 일부 수행한 일정이 여기에 모여요.</p>}
  </section>;
}
