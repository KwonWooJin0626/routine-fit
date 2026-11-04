"use client";
import { useEffect,useRef,useState } from "react";
import { Check,Plus,Trash2 } from "lucide-react";
import { plannerCategories,plannerTodoSchema,type Planner,type PlannerTodo,type PlannerBlock } from "@/lib/planner-model";
import { upsertTodo,toggleTodo,removeTodo,todosForDate } from "@/lib/planner-todos";
import { createPlannerDragPreview } from "@/lib/planner-drag-preview";
import { Dialog,Input,Select } from "./forms";
import type { PlannerChange } from "@/lib/planner-removal";

type Props={planner:Planner;date:string;busy:boolean;compact?:boolean;onSave:(p:Planner,change?:PlannerChange)=>Promise<void>;onPlace?:(t:PlannerTodo)=>void;onDrag?:(id:string|null,x?:number,y?:number)=>void;onPointerStart?:(id:string,x:number,y:number)=>void;onOpenSchedule?:(b:PlannerBlock)=>void;onPlan?:()=>void};
export function PlannerTodos({planner,date,busy,compact=false,onSave,onPlace,onDrag,onPointerStart,onOpenSchedule,onPlan}:Props){
  const [title,setTitle]=useState(""),[editing,setEditing]=useState<PlannerTodo|null>(null),[filter,setFilter]=useState("day"),[error,setError]=useState(""),[showDone,setShowDone]=useState(false);
  const all=planner.todos??[],day=todosForDate(planner,date);
  const filtered=(filter==="all"?all:filter==="unplaced"?all.filter(t=>!planner.blocks.some(b=>b.todoId===t.id)):day);
  const visible=filtered.filter(t=>showDone||t.status!=="done"),rows=compact?visible.slice(0,5):visible;
  const draft=()=>plannerTodoSchema.parse({id:crypto.randomUUID(),title:title.trim()||"새 할 일",todayDate:date});
  const perform=async(action:()=>Promise<void>)=>{try{setError("");await action();}catch(e){setError((e as Error).message);}};
  const add=async()=>{if(!title.trim())return;const todo=plannerTodoSchema.parse({...draft(),title:title.trim()});await onSave(upsertTodo(planner,todo));setTitle("");};
  return <section className={`planner-todos ${compact?"is-compact":""}`} aria-label="To-do 할 일 목록">
    <header><div><span className="eyebrow">MY TO-DO</span><h3>{compact?"오늘의 할 일":"해야 할 일"}</h3></div><span>{day.filter(t=>t.status==="done").length}/{day.length} 완료</span></header>
    <form className="todo-quick-add" onSubmit={e=>{e.preventDefault();void perform(add);}}><label className="sr-only" htmlFor={compact?"home-todo-title":"planner-todo-title"}>새 할 일 제목</label><input id={compact?"home-todo-title":"planner-todo-title"} value={title} maxLength={60} disabled={busy} placeholder="할 일을 입력하고 Enter" onChange={e=>setTitle(e.target.value)}/><button type="submit" className="icon-button" disabled={busy||!title.trim()} aria-label="할 일 추가"><Plus size={18}/></button></form>
    <button type="button" className="text-link todo-new-details" disabled={busy} onClick={()=>setEditing(draft())}>새 할 일 세부 설정</button>
    {!compact&&<div className="todo-filters" role="group" aria-label="할 일 보기">{Object.entries({day:"선택한 날",unplaced:"시간 미정",all:"전체"}).map(([key,label])=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>}
    <div className="todo-list">{rows.map(t=><TodoRow key={t.id} todo={t} busy={busy} onToggle={()=>void perform(()=>onSave(toggleTodo(planner,t.id)))} onDetails={()=>setEditing(t)} onDrag={onDrag} onPointerStart={onPointerStart}/>)}</div>
    {!rows.length&&<p className="todo-empty">{all.length?"이 목록에 남은 할 일이 없어요.":"제목만 적어서 가볍게 시작해요."}</p>}
    <button className="text-link todo-show-done" type="button" onClick={()=>setShowDone(!showDone)}>{showDone?"완료한 할 일 접기":"완료한 할 일 보기"}</button>
    {onPlan&&<button className="text-link" type="button" onClick={onPlan}>계획표에서 할 일·시간 관리하기{visible.length>5?` · 나머지 ${visible.length-5}개`:""}</button>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {editing&&<TodoDetails key={editing.id} todo={editing} planner={planner} date={date} busy={busy} onClose={()=>{if(!busy)setEditing(null);}} onSave={async(todo,linked)=>{
      let next=upsertTodo(planner,todo);
      next={...next,blocks:next.blocks.map(b=>linked.includes(b.id)?{...b,todoId:todo.id}:b.todoId===todo.id?{...b,todoId:undefined}:b)};
      await onSave(next);setTitle("");setEditing(null);
    }} onDelete={async removeSchedules=>{const ids=planner.blocks.filter(b=>b.todoId===editing.id).map(b=>b.id);await onSave(removeTodo(planner,editing.id,removeSchedules),removeSchedules?{remove:{scope:"all",date,blockIds:ids,templateIds:[],removeLibrary:false}}:undefined);setEditing(null);}}
      onPlace={onPlace?async(todo,ids)=>{const next=upsertTodo(planner,todo);await onSave({...next,blocks:next.blocks.map(b=>ids.includes(b.id)?{...b,todoId:todo.id}:b.todoId===todo.id?{...b,todoId:undefined}:b)});setTitle("");setEditing(null);onPlace(todo);}:undefined}
      onOpenSchedule={onOpenSchedule?b=>{setEditing(null);onOpenSchedule(b);}:undefined} onPlan={onPlan}/>}
  </section>;
}

function TodoRow({todo:t,busy,onToggle,onDetails,onDrag,onPointerStart}:{todo:PlannerTodo;busy:boolean;onToggle:()=>void;onDetails:()=>void;onDrag?: (id:string|null,x?:number,y?:number)=>void;onPointerStart?:(id:string,x:number,y:number)=>void}){
  const preview=useRef<HTMLElement|null>(null);
  useEffect(()=>()=>preview.current?.remove(),[]);
  return <article className={`todo-row ${t.status==="done"?"is-done":""}`} draggable={!busy&&!!onDrag} onPointerDown={e=>{if(e.button===0&&!busy&&!(e.target as HTMLElement).closest("button,input"))onPointerStart?.(t.id,e.clientX,e.clientY);}} onDragStart={e=>{if(!onDrag)return;preview.current?.remove();preview.current=createPlannerDragPreview(e.currentTarget,t.title);e.dataTransfer.setData("application/x-routinefit-todo",t.id);e.dataTransfer.effectAllowed="copy";e.dataTransfer.setDragImage(preview.current,40,12);onDrag(t.id);}} onDragEnd={e=>{preview.current?.remove();preview.current=null;onDrag?.(null,e.clientX,e.clientY);}}>
    <button className="todo-check" type="button" disabled={busy} aria-pressed={t.status==="done"} aria-label={`${t.title} 할 일 ${t.status==="done"?"완료 취소":"완료"}`} onClick={onToggle}><span>{t.status==="done"?<Check size={15}/>:null}</span></button><span className="todo-title">{t.title}</span><button className="text-link" type="button" disabled={busy} aria-label={`${t.title} 세부 설정`} onClick={onDetails}>세부 설정</button>
  </article>;
}

function TodoDetails({todo,planner,date,busy,onClose,onSave,onDelete,onPlace,onOpenSchedule,onPlan}:{todo:PlannerTodo;planner:Planner;date:string;busy:boolean;onClose:()=>void;onSave:(t:PlannerTodo,ids:string[])=>Promise<void>;onDelete:(removeSchedules:boolean)=>Promise<void>;onPlace?:(t:PlannerTodo,ids:string[])=>Promise<void>;onOpenSchedule?:(b:PlannerBlock)=>void;onPlan?:()=>void}){
  const [v,set]=useState(todo),[linked,setLinked]=useState(planner.blocks.filter(b=>b.todoId===todo.id).map(b=>b.id)),[line,setLine]=useState(""),[error,setError]=useState(""),[deleting,setDeleting]=useState(false);
  const existing=planner.todos?.some(t=>t.id===todo.id),update=(patch:Partial<PlannerTodo>)=>set(old=>({...old,...patch}));
  const perform=async(action:(t:PlannerTodo)=>Promise<void>)=>{const parsed=plannerTodoSchema.safeParse(v);if(!parsed.success){setError(parsed.error.issues[0].message);return;}try{setError("");await action(parsed.data);}catch(e){setError((e as Error).message);}};
  const addLine=()=>{if(line.trim()&&v.checklist.length<30){update({checklist:[...v.checklist,{id:crypto.randomUUID(),text:line.trim(),done:false}]});setLine("");}};
  return <Dialog title="할 일 세부 설정" subtitle="마감일은 완료 기한, 일정 배치는 실제로 할 시간을 정하는 설정이에요." onClose={onClose}><form onSubmit={e=>{e.preventDefault();void perform(t=>onSave(t,linked));}}>
    <div className="form-grid"><div className="form-span"><Input label="할 일 제목" required value={v.title} onChange={title=>update({title:title.slice(0,60)})}/></div>
      <Select label="할 일 카테고리" value={v.category??""} options={{"":"선택하지 않음",...plannerCategories}} onChange={category=>update({category:(category||undefined) as PlannerTodo["category"]})}/>
      <Input label="마감일 (선택)" type="date" value={v.dueDate??""} onChange={dueDate=>update({dueDate:dueDate||undefined})}/>
      <Input label="할 일 목록에 담을 날짜 (선택)" type="date" value={v.todayDate??""} onChange={todayDate=>update({todayDate:todayDate||undefined})}/>
      <Input label="예상 소요 시간 (분, 선택)" type="number" min={5} max={720} value={v.estimate??""} hint="실제 수행 시간과 별도로 보관해요." onChange={n=>update({estimate:n?Number(n):undefined})}/>
      <div className="form-span"><Input label="장소 (선택)" value={v.location} onChange={location=>update({location:location.slice(0,100)})}/></div>
      <div className="form-span field"><label htmlFor="todo-notes">메모 (선택)</label><textarea id="todo-notes" rows={3} maxLength={1000} value={v.notes} onChange={e=>update({notes:e.target.value})}/></div>
    </div>
    <section className="todo-detail-section"><h3>체크리스트</h3>{v.checklist.map(item=><div className="todo-checklist-row" key={item.id}><label><input type="checkbox" checked={item.done} onChange={e=>update({checklist:v.checklist.map(x=>x.id===item.id?{...x,done:e.target.checked}:x)})}/>{item.text}</label><button type="button" className="icon-button" aria-label={`${item.text} 세부 할 일 삭제`} onClick={()=>update({checklist:v.checklist.filter(x=>x.id!==item.id)})}><Trash2 size={14}/></button></div>)}<div className="todo-checklist-add" onKeyDown={e=>{if(e.key==="Enter"&&!e.nativeEvent.isComposing&&e.target instanceof HTMLInputElement){e.preventDefault();addLine();}}}><Input label="세부 할 일" value={line} onChange={x=>setLine(x.slice(0,100))}/><button type="button" className="button secondary" disabled={!line.trim()||v.checklist.length>=30} onClick={addLine}>추가</button></div></section>
    <section className="todo-detail-section"><h3>일정에 배치하기</h3><p>여러 시간대로 나눠서 배치할 수 있어요. 일정 한 번을 마쳐도 전체 할 일은 자동 완료하지 않아요.</p>{onPlace?<button type="button" className="button secondary" disabled={busy} onClick={()=>void perform(t=>onPlace(t,linked))}>저장하고 시간 정하기</button>:onPlan?<button type="button" className="button secondary" onClick={()=>{onClose();onPlan();}}>계획표에서 시간 정하기</button>:null}
      {planner.blocks.filter(b=>b.todoId===todo.id).map(b=><div className="todo-linked-row" key={b.id}><span>{b.title} · {b.start}–{b.end} · {b.kind==="fixed"?"매주 반복":b.date}</span>{onOpenSchedule&&<button type="button" className="text-link" disabled={busy} onClick={()=>onOpenSchedule(b)}>일정 열기</button>}</div>)}
      <details><summary>기존 일정 연결·해제</summary>{planner.blocks.length?planner.blocks.map(b=><label className="check-choice todo-link-choice" key={b.id}><input type="checkbox" checked={linked.includes(b.id)} disabled={!!b.todoId&&b.todoId!==todo.id} onChange={e=>setLinked(old=>e.target.checked?[...old,b.id]:old.filter(id=>id!==b.id))}/>{b.title} · {b.start}–{b.end}{b.todoId&&b.todoId!==todo.id?" · 다른 할 일에 연결됨":""}</label>):<p>등록된 일정이 없어요.</p>}</details>
    </section>
    <p className="muted">할 일 체크는 완료 상태만 저장해요. 강아지 성장에는 연결 일정에서 확인한 실제 수행 기록을 한 번만 반영해요.</p>
    {deleting&&<div className="todo-delete-options"><p>연결된 일정도 함께 제거할까요? 실제 수행 기록은 보존해요.</p><button type="button" className="button secondary" disabled={busy} onClick={()=>void onDelete(false).catch(e=>setError((e as Error).message))}>할 일만 삭제</button><button type="button" className="button danger" disabled={busy} onClick={()=>void onDelete(true).catch(e=>setError((e as Error).message))}>연결 일정도 삭제</button></div>}
    {error&&<p className="form-error" role="alert">{error}</p>}<div className="dialog-actions">{existing&&<button type="button" className="button danger" disabled={busy} onClick={()=>setDeleting(!deleting)}>삭제</button>}<button type="button" className="button secondary" disabled={busy} onClick={onClose}>닫기</button><button className="button primary" disabled={busy}>할 일 저장</button></div>
  </form></Dialog>;
}
