"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Dialog } from "./forms";
import { toTime } from "@/lib/model";
import { occurrencesInWindow } from "@/lib/planner";
import { plannerSwatch } from "@/lib/planner-colors";
import { monthItems, monthWeeks, moveMonth, monthlyTodosForDate, dateUnassignedTodos, monthWeekItems } from "@/lib/planner-month";
import { attachMonthTouchRange } from "@/lib/month-touch-range";
import type { Planner, PlannerBlock, PlannerTodo } from "@/lib/planner-model";

const weekdays=["월","화","수","목","금","토","일"];
const dayLabel=new Intl.DateTimeFormat("ko-KR",{month:"long",day:"numeric",weekday:"long",timeZone:"UTC"});
const formatDay=(date:string)=>dayLabel.format(new Date(`${date}T12:00Z`));
const range=(a:string,b:string)=>a<=b?{start:a,end:b}:{start:b,end:a};

function monthDateAt(grid:HTMLDivElement,x:number,y:number){
    const target=document.elementFromPoint(x,y);
    if(!target||!grid.contains(target))return;
    const direct=target.closest<HTMLElement>("[data-month-cell]");
    if(direct)return direct.dataset.monthCell;
    const row=target.closest(".month-week");
    return Array.from(row?.querySelectorAll<HTMLElement>("[data-month-cell]")??[]).find(cell=>{
      const {left,right}=cell.getBoundingClientRect();return left<=x&&x<right;
    })?.dataset.monthCell;
  }

type Props={
  planner:Planner;selected:string;today:string;busy:boolean;
  onSelect:(date:string)=>void;onDay:()=>void;
  onAdd:(date:string|null,end?:string)=>void;
  onEditTodo:(todo:PlannerTodo,date:string)=>void;
  onToggleTodo:(id:string)=>void;
  onEditBlock:(block:PlannerBlock,date:string)=>void;
};

export function PlannerMonthView({planner,selected,today,busy,onSelect,onDay,onAdd,onEditTodo,onToggleTodo,onEditBlock}:Props){
  const [detail,setDetail]=useState<"day"|"unassigned"|null>(null);
  const [condensed,setCondensed]=useState(true),[excludeFixed,setExcludeFixed]=useState(false);
  const month=selected.slice(0,7);
  const weekData=useMemo(()=>{
    const weeks=monthWeeks(month+"-01");
    const items=monthItems(planner,weeks,excludeFixed);
    return weeks.map(week=>({week,...monthWeekItems(items,week,condensed)}));
  },[month,planner,condensed,excludeFixed]);
  const todos=monthlyTodosForDate(planner,selected);
  const schedules=occurrencesInWindow(planner,selected).filter(row=>!excludeFixed||row.block.kind!=="fixed");
  const unassigned=dateUnassignedTodos(planner);
  const [preview,setPreview]=useState<{start:string;end:string}|null>(null);
  const drag=useRef<{pointerId:number;start:string}|null>(null);
  const ignoreClick=useRef(false);
  const gridRef=useRef<HTMLDivElement>(null);
  const onAddRef=useRef(onAdd);
  useEffect(()=>{onAddRef.current=onAdd;},[onAdd]);
  useEffect(()=>{
    const grid=gridRef.current;if(!grid||busy)return;
    return attachMonthTouchRange(grid,{dateAt:(x,y)=>monthDateAt(grid,x,y),onPreview:setPreview,onChoose:chosen=>{ignoreClick.current=true;onAddRef.current(chosen.start,chosen.end);}});
  },[busy,month]);
  const dayPanel=useRef<HTMLElement>(null);
  const colors=(category:PlannerBlock["category"],shade=1)=>plannerSwatch(category,shade,planner.categoryColors);

  function pickCell(event:PointerEvent<HTMLDivElement>){return monthDateAt(event.currentTarget,event.clientX,event.clientY);}

  function startRange(event:PointerEvent<HTMLDivElement>){
    ignoreClick.current=false;
    if(event.pointerType!=="mouse"||event.button!==0||busy)return;
    const date=(event.target as HTMLElement).closest<HTMLElement>("button[data-month-date]")?.dataset.monthDate;
    if(date)drag.current={pointerId:event.pointerId,start:date};
  }

  function moveRange(event:PointerEvent<HTMLDivElement>){
    const current=drag.current;
    if(!current||current.pointerId!==event.pointerId||event.buttons!==1)return;
    const end=pickCell(event);
    if(!end||end===current.start&&!preview)return;
    if(!event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.setPointerCapture(event.pointerId);
    const next=range(current.start,end);
    if(next.start!==preview?.start||next.end!==preview.end)setPreview(next);
  }

  function stopRange(event:PointerEvent<HTMLDivElement>){
    const current=drag.current;
    if(!current||current.pointerId!==event.pointerId)return;
    const end=pickCell(event);
    drag.current=null;
    setPreview(null);
    if(end&&end!==current.start){
      const chosen=range(current.start,end);
      ignoreClick.current=true;
      onAdd(chosen.start,chosen.end);
    }
  }

  function showDay(event:MouseEvent<HTMLButtonElement>,date:string,showList=false){
    if(ignoreClick.current&&event.detail>0){ignoreClick.current=false;return;}
    onSelect(date);
    setDetail("day");
  }

  function todoRow(todo:PlannerTodo,date:string){
    return <li key={todo.id} className={todo.status==="done"?"is-done":""} style={colors(todo.category??"task")}>
      <button type="button" className="todo-check" aria-pressed={todo.status==="done"} disabled={busy||date>today}
        aria-label={`${todo.title} ${todo.status==="done"?"완료 취소":"완료"}`} onClick={()=>onToggleTodo(todo.id)}><span>{todo.status==="done"&&<Check size={14}/>}</span></button>
      <button type="button" className="month-item-title" onClick={()=>{setDetail(null);onEditTodo(todo,date);}}>
        <span>{todo.important&&"★ "}{todo.title}</span>
        {todo.dueDate===date&&<small>마감</small>}
      </button>
    </li>;
  }

  return <section className="panel month-planner" data-condensed={condensed} aria-label="월간 계획표">
    <header className="month-planner-header">
      <div className="sp-date-nav">
        <button type="button" className="icon-button" aria-label="이전 달" onClick={()=>onSelect(moveMonth(selected,-1))}><ChevronLeft size={18}/></button>
        <h2>{selected.slice(0,4)}년 {Number(selected.slice(5,7))}월</h2>
        <button type="button" className="icon-button" aria-label="다음 달" onClick={()=>onSelect(moveMonth(selected,1))}><ChevronRight size={18}/></button>
        <button type="button" className="sp-today" onClick={()=>onSelect(today)}>오늘</button>
      </div>
      <div className="month-display-toggles" role="group" aria-label="월간 일정 표시 설정">
        <button type="button" role="switch" aria-checked={condensed} onClick={()=>setCondensed(v=>!v)}><span className="month-switch-track" aria-hidden="true"><i/></span>일정 생략</button>
        <button type="button" role="switch" aria-checked={excludeFixed} onClick={()=>setExcludeFixed(v=>!v)}><span className="month-switch-track" aria-hidden="true"><i/></span>고정 스케줄 제외</button>
      </div>
      <button type="button" className="button primary" aria-label="할 일 추가" title="할 일 추가" disabled={busy} onClick={()=>onAdd(selected)}><Plus size={16}/><span className="month-add-label">할 일 추가</span></button>
    </header>
    <p className="month-range-hint" role="status">{preview?formatDay(preview.start)+(preview.start===preview.end?"":' ~ '+formatDay(preview.end))+" 선택 중 · 손을 떼면 할 일을 추가해요":"휴대폰은 날짜를 꾹 누른 뒤 드래그해 기간을 선택해요. PC는 날짜 사이를 드래그하세요."}</p>
    <div className="month-weekdays" aria-hidden="true">{weekdays.map(day=><span key={day}>{day}</span>)}</div>
    <div ref={gridRef} className="month-grid" data-range-selecting={!!preview} onClickCapture={event=>{if(ignoreClick.current&&event.detail>0){ignoreClick.current=false;event.preventDefault();event.stopPropagation();}}} onPointerDown={startRange} onPointerMove={moveRange} onPointerUp={stopRange} onPointerCancel={event=>{if(event.pointerType!=="touch"){drag.current=null;setPreview(null);}}} onLostPointerCapture={()=>{if(drag.current){drag.current=null;setPreview(null);}}}>
      {weekData.map(({week,visible,overflow,rowCount})=><div className="month-week" key={week[0]} style={condensed?undefined:{gridTemplateRows:`24px repeat(${rowCount},24px)`}}>
        {week.map((date,index)=><div key={date} className="month-cell" data-month-cell={date}
          data-outside={date.slice(0,7)!==month} data-selected={selected===date}
          data-preview={!!preview&&preview.start<=date&&date<=preview.end} style={{gridColumn:index+1,...(!condensed?{gridRow:`1 / ${rowCount+2}`}:{})}}
          onClick={event=>{if(event.target===event.currentTarget)onSelect(date);}}>
          <button type="button" data-month-date={date} className="month-date"
          aria-label={formatDay(date)} aria-pressed={selected===date}
          aria-current={date===today?"date":undefined} onClick={event=>showDay(event,date)}><span>{Number(date.slice(8))}</span></button></div>)}
        {visible.map(({item,start,end,row})=>{
          const schedule=item.kind==="schedule"?item.occurrence:undefined;
          const todo=item.kind==="schedule"?undefined:item.todo;
          const title=schedule?`${toTime(schedule.from)} ${schedule.block.title}`:
            `${item.kind==="due"||todo?.dueDate===item.start&&item.start===item.end?"마감 · ":""}${todo?.important?"★ ":""}${todo?.title}`;
          const date=selected>=week[start]&&selected<=week[end]?selected:week[start];
          return <button type="button" key={schedule?`${start}:${schedule.block.id}:${schedule.date}`:`${item.kind}:${todo?.id}`}
            className={`month-chip ${item.kind} ${todo?.status==="done"?"is-done":""}`}
            title={title} onClick={()=>schedule?onEditBlock(schedule.block,schedule.date):todo&&onEditTodo(todo,date)}
            style={{...colors(schedule?.block.category??todo?.category??"task",schedule?.block.shade),gridColumn:`${start+1} / ${end+2}`,gridRow:row+2}}>
            {title}
          </button>;
        })}
        {overflow.map((count,index)=>count>0&&<button key={week[index]} type="button" className="month-overflow"
          aria-label={`${formatDay(week[index])} ${count}개 더 보기`} style={{gridColumn:index+1}}
          onClick={event=>showDay(event,week[index],true)}>+{count}개</button>)}
      </div>)}
    </div>
    <div className="month-quick-actions"><button type="button" className="text-link" onClick={()=>setDetail("day")}>선택한 날짜 일정</button><button type="button" className="text-link" onClick={()=>setDetail("unassigned")}>날짜 미정 · {unassigned.length}개</button></div>
    {detail&&<Dialog title={detail==="day"?formatDay(selected)+" 일정":"날짜 미정 할 일"} onClose={()=>setDetail(null)}><section hidden={detail!=="day"} className="month-day-panel" ref={dayPanel} tabIndex={-1} aria-label={`${formatDay(selected)} 할 일과 일정`}>
      <header><h3>{formatDay(selected)}</h3><button type="button" className="text-link" onClick={()=>{setDetail(null);onDay();}}>하루 시간표 <ChevronRight size={14}/></button></header>
      {todos.length>0&&<><h4>할 일</h4><ul className="month-item-list">{todos.map(todo=>todoRow(todo,selected))}</ul></>}
      {schedules.length>0&&<><h4>시간이 정해진 일정</h4><ul className="month-item-list">{schedules.map(row=><li key={`${row.block.id}:${row.date}`} style={colors(row.block.category,row.block.shade)}>
        <button type="button" className="month-item-title" onClick={()=>{setDetail(null);onEditBlock(row.block,row.date);}}><CalendarDays size={15}/><span>{row.block.title}</span><small>{toTime(row.from)}–{row.until===1440?"24:00":toTime(row.until)}</small></button>
      </li>)}</ul></>}
      {!todos.length&&!schedules.length&&<p className="muted">등록된 할 일과 일정이 없어요.</p>}
    </section>
    <section hidden={detail!=="unassigned"} className="month-unassigned">
      <header><h3>날짜 미정 <small>{unassigned.length}개</small></h3><button type="button" className="text-link" disabled={busy} onClick={()=>{setDetail(null);onAdd(null);}}><Plus size={14}/>날짜 없이 추가</button></header>
      {unassigned.length>0&&<ul className="month-item-list">{unassigned.map(todo=>todoRow(todo,today))}</ul>}
    </section></Dialog>}
  </section>;
}
