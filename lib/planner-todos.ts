import { plannerSchema,plannerTodoSchema,type Planner,type PlannerTodo } from "./planner-model";
import { occursOn } from "./planner";

export function upsertTodo(p:Planner,value:PlannerTodo):Planner{
  const todo=plannerTodoSchema.parse(value),old=p.todos?.find(t=>t.id===todo.id);
  return plannerSchema.parse({...p,todos:old?p.todos!.map(t=>t.id===todo.id?todo:t):[...(p.todos??[]),todo],
    blocks:p.blocks.map(b=>b.todoId===todo.id?{...b,...(old&&b.title===old.title?{title:todo.title}:{}),...(todo.category?{category:todo.category}:{} )}:b)});
}
// Checking a task records completion only; planned minutes never become execution/XP.
export function toggleTodo(p:Planner,id:string,now=new Date()):Planner{
  const todo=p.todos?.find(t=>t.id===id);if(!todo)throw new Error("할 일을 찾을 수 없어요.");
  return upsertTodo(p,{...todo,status:todo.status==="done"?"open":"done",completedAt:todo.status==="done"?undefined:now.toISOString()});
}
export function removeTodo(p:Planner,id:string,removeSchedules=false):Planner{
  return plannerSchema.parse({...p,todos:(p.todos??[]).filter(t=>t.id!==id),blocks:p.blocks.flatMap(b=>{
    if(b.todoId!==id)return [b];if(removeSchedules)return [];const {todoId,...rest}=b;return [rest];
  })});
}
export function todosForDate(p:Planner,date:string){
  return (p.todos??[]).filter(t=>t.todayDate===date||t.status!=="done"&&!!t.dueDate&&t.dueDate<=date||p.blocks.some(b=>b.todoId===t.id&&occursOn(b,date)));
}
