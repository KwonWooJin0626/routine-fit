"use client";
import { useEffect,useRef,useState } from "react";
import { CalendarDays,Check,ClipboardList,ListChecks,Palette,Plus,Settings2,Star,Trash2 } from "lucide-react";
import { plannerSwatch } from "@/lib/planner-colors";
import { plannerCategories,plannerTodoSchema,type Planner,type PlannerTodo,type PlannerBlock } from "@/lib/planner-model";
import { upsertTodo,toggleTodo,removeTodo,todosForDate } from "@/lib/planner-todos";
import { createPlannerDragPreview } from "@/lib/planner-drag-preview";
import { Dialog,Input,Select } from "./forms";
import type { PlannerChange } from "@/lib/planner-removal";

type Props={planner:Planner;date:string;busy:boolean;compact?:boolean;onTodoChecked?:()=>void;onRecordTodo?:(todo:PlannerTodo,date:string)=>void;onSave:(p:Planner,change?:PlannerChange)=>Promise<void>;onPlace?:(t:PlannerTodo)=>void;onDrag?:(id:string|null,x?:number,y?:number)=>void;onPointerStart?:(id:string,x:number,y:number)=>void;onOpenSchedule?:(b:PlannerBlock)=>void;onPlan?:()=>void};
export function PlannerTodos({planner,date,busy,compact=false,onTodoChecked,onRecordTodo,onSave,onPlace,onDrag,onPointerStart,onOpenSchedule,onPlan}:Props){
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
    <div className="todo-list">{rows.map(t=><TodoRow key={t.id} todo={t} busy={busy} onToggle={()=>{if(onRecordTodo){onRecordTodo(t,date);return;}void perform(async()=>{await onSave(toggleTodo(planner,t.id));if(t.status!=="done")onTodoChecked?.();});}} onDetails={()=>setEditing(t)} onRecord={onRecordTodo?()=>onRecordTodo(t,date):undefined} onDrag={onDrag} onPointerStart={onPointerStart}/>)}</div>
    {!rows.length&&<p className="todo-empty">{all.length?"이 목록에 남은 할 일이 없어요.":"제목만 적어서 가볍게 시작해요."}</p>}
    <button className="text-link todo-show-done" type="button" onClick={()=>setShowDone(!showDone)}>{showDone?"완료한 할 일 접기":"완료한 할 일 보기"}</button>
    {onPlan&&<button className="text-link" type="button" onClick={onPlan}>계획표에서 할 일·시간 관리하기{visible.length>5?` · 나머지 ${visible.length-5}개`:""}</button>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    {editing&&<PlannerTodoEditor key={editing.id} todo={editing} planner={planner} date={date} busy={busy}
      onClose={()=>{if(!busy)setEditing(null);}} onSaved={()=>{setTitle("");setEditing(null);}}
      onSave={onSave} onPlace={onPlace}
      onOpenSchedule={onOpenSchedule?b=>{setEditing(null);onOpenSchedule(b);}:undefined} onPlan={onPlan}/>}
  </section>;
}

type EditorProps=Pick<Props,"planner"|"date"|"busy"|"onSave"|"onPlace"|"onOpenSchedule"|"onPlan">&{
  todo:PlannerTodo;onClose:()=>void;onSaved:()=>void;quick?:boolean;
};

export function PlannerTodoEditor({todo,planner,date,busy,onClose,onSaved,onSave,onPlace,onOpenSchedule,onPlan,quick}:EditorProps){
  const save=async(value:PlannerTodo,linked:string[])=>{
    const next=upsertTodo(planner,value);
    const blocks=next.blocks.map(block=>{
      if(linked.includes(block.id)&&(!block.todoId||block.todoId===value.id))return {...block,todoId:value.id};
      return block.todoId===value.id?{...block,todoId:undefined}:block;
    });
    await onSave({...next,blocks});
    onSaved();
  };
  const remove=async(removeSchedules:boolean)=>{
    const ids=planner.blocks.filter(block=>block.todoId===todo.id).map(block=>block.id);
    await onSave(removeTodo(planner,todo.id,removeSchedules),removeSchedules?{remove:{scope:"all",date,blockIds:ids,templateIds:[],removeLibrary:false}}:undefined);
    onSaved();
  };
  return <TodoDetails todo={todo} planner={planner} date={date} busy={busy} quick={quick} onClose={onClose} onSave={save} onDelete={remove}
    onPlace={onPlace?async(value,linked)=>{await save(value,linked);onPlace(value);}:undefined}
    onOpenSchedule={onOpenSchedule} onPlan={onPlan}/>;
}

function TodoRow({todo:t,busy,onToggle,onDetails,onRecord,onDrag,onPointerStart}:{todo:PlannerTodo;busy:boolean;onToggle:()=>void;onDetails:()=>void;onRecord?:()=>void;onDrag?: (id:string|null,x?:number,y?:number)=>void;onPointerStart?:(id:string,x:number,y:number)=>void}){
  const preview=useRef<HTMLElement|null>(null);
  useEffect(()=>()=>preview.current?.remove(),[]);
  return <article className={`todo-row ${t.status==="done"?"is-done":""}`} draggable={!busy&&!!onDrag} onPointerDown={e=>{if(e.button===0&&!busy&&!(e.target as HTMLElement).closest("button,input"))onPointerStart?.(t.id,e.clientX,e.clientY);}} onDragStart={e=>{if(!onDrag)return;preview.current?.remove();preview.current=createPlannerDragPreview(e.currentTarget,t.title);e.dataTransfer.setData("application/x-routinefit-todo",t.id);e.dataTransfer.effectAllowed="copy";e.dataTransfer.setDragImage(preview.current,40,12);onDrag(t.id);}} onDragEnd={e=>{preview.current?.remove();preview.current=null;onDrag?.(null,e.clientX,e.clientY);}}>
    <button className="todo-check" type="button" disabled={busy} aria-pressed={t.status==="done"} aria-label={`${t.title} 할 일 ${t.status==="done"?"완료 취소":"완료"}`} onClick={onToggle}><span>{t.status==="done"?<Check size={15}/>:null}</span></button><span className="todo-title">{t.title}</span>{onRecord&&<button className="text-link" type="button" disabled={busy} aria-label={`${t.title} 실제 시간`} onClick={onRecord}>실제 시간</button>}<button className="text-link" type="button" disabled={busy} aria-label={`${t.title} 세부 설정`} onClick={onDetails}>세부 설정</button>
  </article>;
}

function TodoDetails({todo,planner,date,busy,quick,onClose,onSave,onDelete,onPlace,onOpenSchedule,onPlan}:{todo:PlannerTodo;planner:Planner;date:string;busy:boolean;quick?:boolean;onClose:()=>void;onSave:(t:PlannerTodo,ids:string[])=>Promise<void>;onDelete:(removeSchedules:boolean)=>Promise<void>;onPlace?:(t:PlannerTodo,ids:string[])=>Promise<void>;onOpenSchedule?:(b:PlannerBlock)=>void;onPlan?:()=>void}){
  const [v,set]=useState(todo),[linked,setLinked]=useState(planner.blocks.filter(b=>b.todoId===todo.id).map(b=>b.id)),[line,setLine]=useState(""),[error,setError]=useState(""),[deleting,setDeleting]=useState(false);
  const existing=planner.todos?.some(t=>t.id===todo.id),update=(patch:Partial<PlannerTodo>)=>set(old=>({...old,...patch}));
  const perform=async(action:(t:PlannerTodo)=>Promise<void>)=>{const parsed=plannerTodoSchema.safeParse(v);if(!parsed.success){setError(parsed.error.issues[0].message);return;}try{setError("");await action(parsed.data);}catch(e){setError((e as Error).message);}};
  const addLine=()=>{if(line.trim()&&v.checklist.length<30){update({checklist:[...v.checklist,{id:crypto.randomUUID(),text:line.trim(),done:false}]});setLine("");}};
  const [panel,setPanel]=useState<"dates"|"category"|"notes"|"checklist"|"settings"|null>(null);
  const show=(id:typeof panel)=>!quick||panel===id;
  const choose=(id:NonNullable<typeof panel>)=>setPanel(active=>active===id?null:id);
  const dateLabel=v.period?`${v.period.start.slice(5)} ~ ${v.period.end.slice(5)}`:v.todayDate?.slice(5)??"날짜 미정";
  return <Dialog title={quick?"할 일 추가":"할 일 세부 설정"} onClose={onClose} className="todo-editor-dialog"><form className="todo-editor" onSubmit={e=>{e.preventDefault();void perform(t=>onSave(t,linked));}}>
    <Input label="할 일 제목" placeholder="할 일을 입력하세요" required value={v.title} onChange={title=>update({title:title.slice(0,60)})}/>
    {quick&&<div className="todo-editor-tools" role="group" aria-label="할 일 선택 설정">
      <button type="button" aria-expanded={panel==="dates"} onClick={()=>choose("dates")}><CalendarDays size={15}/>{dateLabel}</button>
      <button type="button" aria-expanded={panel==="category"} onClick={()=>choose("category")}><Palette size={15}/>{v.category?plannerCategories[v.category]:"카테고리"}</button>
      <button type="button" aria-expanded={panel==="notes"} onClick={()=>choose("notes")}><ClipboardList size={15}/>메모</button>
      <button type="button" aria-expanded={panel==="checklist"} onClick={()=>choose("checklist")}><ListChecks size={15}/>체크리스트</button>
      <button type="button" aria-expanded={panel==="settings"} onClick={()=>choose("settings")}><Settings2 size={15}/>세부 설정</button>
    </div>}
    {show("dates")&&<div className="form-grid todo-editor-fields">
      <Select label="날짜 방식" value={v.period?"period":v.todayDate?"day":"none"} options={{day:"하루",period:"기간",none:"날짜 미정"}} onChange={kind=>{
        const start=v.period?.start??v.todayDate??date;
        update({todayDate:kind==="day"?start:undefined,period:kind==="period"?{start,end:v.period?.end??start}:undefined});
      }}/>
      {v.period?<><Input label="시작일" type="date" value={v.period.start} onChange={start=>update({period:{start,end:v.period!.end}})}/><Input label="마지막 날" type="date" value={v.period.end} onChange={end=>update({period:{start:v.period!.start,end}})}/></>:v.todayDate!==undefined&&<Input label="할 일 날짜" type="date" value={v.todayDate} onChange={todayDate=>update({todayDate})}/>}
    </div>}
    {show("category")&&<div className="todo-editor-fields">
      <span className="todo-field-title">카테고리</span>
      <div className="todo-category-options" role="group" aria-label="할 일 카테고리">
        {Object.entries(plannerCategories).map(([id,label])=>{const category=id as keyof typeof plannerCategories;return <button key={id} type="button" style={plannerSwatch(category,1,planner.categoryColors)} aria-pressed={v.category===category} onClick={()=>update({category:v.category===category?undefined:category})}><i/>{label}</button>;})}
      </div>
      <label className="todo-important"><input type="checkbox" checked={v.important??false} onChange={e=>update({important:e.target.checked})}/><Star size={15}/>중요한 할 일</label>
    </div>}
    {show("settings")&&<div className="form-grid todo-editor-fields">
      <Input label="마감일 (선택)" type="date" value={v.dueDate??""} onChange={dueDate=>update({dueDate:dueDate||undefined})}/>
      <Select label="예상 정신적 부담 (선택)" value={String(v.mental??"")} options={{"":"미입력",1:"1",2:"2",3:"3",4:"4",5:"5"}} onChange={value=>update({mental:value?Number(value):undefined})}/>
      <Select label="예상 육체적 피로 (선택)" value={String(v.physical??"")} options={{"":"미입력",1:"1",2:"2",3:"3",4:"4",5:"5"}} onChange={value=>update({physical:value?Number(value):undefined})}/>
      <Input label="예상 소요 시간 (분, 선택)" type="number" min={5} max={720} value={v.estimate??""} hint="실제 수행 시간과 별도로 보관해요." onChange={n=>update({estimate:n?Number(n):undefined})}/>
      <div className="form-span"><Input label="장소 (선택)" value={v.location} onChange={location=>update({location:location.slice(0,100)})}/></div>
    </div>}
    {show("notes")&&<div className="field todo-editor-fields"><label>메모 (선택)<textarea rows={3} maxLength={1000} value={v.notes} onChange={e=>update({notes:e.target.value})}/></label></div>}
    {show("checklist")&&<section className="todo-detail-section"><h3>체크리스트</h3>{v.checklist.map(item=><div className="todo-checklist-row" key={item.id}><label><input type="checkbox" checked={item.done} onChange={e=>update({checklist:v.checklist.map(x=>x.id===item.id?{...x,done:e.target.checked}:x)})}/>{item.text}</label><button type="button" className="icon-button" aria-label={`${item.text} 세부 할 일 삭제`} onClick={()=>update({checklist:v.checklist.filter(x=>x.id!==item.id)})}><Trash2 size={14}/></button></div>)}<div className="todo-checklist-add" onKeyDown={e=>{if(e.key==="Enter"&&!e.nativeEvent.isComposing&&e.target instanceof HTMLInputElement){e.preventDefault();addLine();}}}><Input label="세부 할 일" value={line} onChange={x=>setLine(x.slice(0,100))}/><button type="button" className="button secondary" disabled={!line.trim()||v.checklist.length>=30} onClick={addLine}>추가</button></div></section>}
    {show("settings")&&<section className="todo-detail-section"><h3>일정에 배치하기</h3><p>한 할 일을 여러 시간대로 나눠서 배치할 수 있어요.</p>{onPlace?<button type="button" className="button secondary" disabled={busy||!v.title.trim()} onClick={()=>void perform(t=>onPlace(t,linked))}>저장하고 시간 정하기</button>:onPlan?<button type="button" className="button secondary" onClick={()=>{onClose();onPlan();}}>계획표에서 시간 정하기</button>:null}
      {planner.blocks.filter(b=>b.todoId===todo.id).map(b=><div className="todo-linked-row" key={b.id}><span>{b.title} · {b.start}–{b.end} · {b.kind==="fixed"?"매주 반복":b.date}</span>{onOpenSchedule&&<button type="button" className="text-link" disabled={busy} onClick={()=>onOpenSchedule(b)}>일정 열기</button>}</div>)}
      <details><summary>기존 일정 연결·해제</summary>{planner.blocks.length?planner.blocks.map(b=><label className="check-choice todo-link-choice" key={b.id}><input type="checkbox" checked={linked.includes(b.id)} disabled={!!b.todoId&&b.todoId!==todo.id} onChange={e=>setLinked(old=>e.target.checked?[...old,b.id]:old.filter(id=>id!==b.id))}/>{b.title} · {b.start}–{b.end}{b.todoId&&b.todoId!==todo.id?" · 다른 할 일에 연결됨":""}</label>):<p>등록된 일정이 없어요.</p>}</details>
    </section>}
    {deleting&&<div className="todo-delete-options"><p>연결된 일정도 함께 제거할까요? 실제 수행 기록은 보존해요.</p><button type="button" className="button secondary" disabled={busy} onClick={()=>void onDelete(false).catch(e=>setError((e as Error).message))}>할 일만 삭제</button><button type="button" className="button danger" disabled={busy} onClick={()=>void onDelete(true).catch(e=>setError((e as Error).message))}>연결 일정도 삭제</button></div>}
    {error&&<p className="form-error" role="alert">{error}</p>}<div className="dialog-actions">{existing&&<button type="button" className="button danger" disabled={busy} onClick={()=>setDeleting(!deleting)}>삭제</button>}<button type="button" className="button secondary" disabled={busy} onClick={onClose}>닫기</button><button className="button primary" disabled={busy||!v.title.trim()}>{quick?"추가":"할 일 저장"}</button></div>
  </form></Dialog>;
}
