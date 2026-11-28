import { addDate, mondayOf, occurrencesInWindow } from "./planner";
import type { Occurrence } from "./planner";
import type { Planner, PlannerTodo } from "./planner-model";
import { todoCoversDate } from "./planner-todos";

type Span = {start:string;end:string};
export type MonthItem = Span & (
  {kind:"todo"|"due";todo:PlannerTodo} |
  {kind:"schedule";occurrence:Occurrence}
);

export function moveMonth(date:string,amount:number){
  const day=new Date(`${date}T12:00Z`);
  const previousDay=day.getUTCDate();
  day.setUTCDate(1);
  day.setUTCMonth(day.getUTCMonth()+amount+1,0);
  day.setUTCDate(Math.min(previousDay,day.getUTCDate()));
  return day.toISOString().slice(0,10);
}

export function monthWeeks(date:string){
  const first=date.slice(0,7)+"-01";
  const end=moveMonth(first,1);
  const weeks:string[][]=[];
  for(let start=mondayOf(first);start<end;start=addDate(start,7)){
    weeks.push(Array.from({length:7},(_,index)=>addDate(start,index)));
  }
  return weeks;
}

export function monthlyTodosForDate(planner:Planner,date:string){
  return (planner.todos??[]).filter(todo=>todoCoversDate(todo,date)||todo.dueDate===date);
}

export function dateUnassignedTodos(planner:Planner){
  const placed=new Set(planner.blocks.flatMap(block=>block.todoId?[block.todoId]:[]));
  return (planner.todos??[]).filter(todo=>!todo.period&&!todo.todayDate&&!todo.dueDate&&!placed.has(todo.id));
}

export function monthItems(planner:Planner,weeks:string[][],excludeFixed=false):MonthItem[]{
  const days=weeks.flat();
  const items:MonthItem[]=[];
  for(const todo of planner.todos??[]){
    const span=todo.period??(todo.todayDate?{start:todo.todayDate,end:todo.todayDate}:undefined);
    if(span)items.push({kind:"todo",todo,...span});
    if(todo.dueDate&&!(span?.start===todo.dueDate&&span.end===todo.dueDate)){
      items.push({kind:"due",todo,start:todo.dueDate,end:todo.dueDate});
    }
  }
  items.sort((a,b)=>Number(b.start!==b.end)-Number(a.start!==a.end)||
    Number(b.kind==="due")-Number(a.kind==="due")||a.start.localeCompare(b.start));
  for(const day of days){
    for(const occurrence of occurrencesInWindow(planner,day)){
      if(excludeFixed&&occurrence.block.kind==="fixed")continue;
      items.push({kind:"schedule",occurrence,start:day,end:day});
    }
  }
  return items;
}

export function weekItems(items:MonthItem[],week:string[],visibleRows=2){
  const rows:MonthItem[][]=Array.from({length:visibleRows},()=>[]);
  const overflow=week.map(()=>new Set<string>());
  const visible=items.flatMap(item=>{
    if(item.end<week[0]||item.start>week[6])return [];
    const start=week.findIndex(day=>day>=item.start);
    const end=week.findLastIndex(day=>day<=item.end);
    const row=rows.findIndex(entries=>entries.every(entry=>item.end<entry.start||item.start>entry.end));
    if(row<0){
      const id=item.kind==="schedule"?`schedule-${item.occurrence.block.id}-${item.occurrence.date}`:item.todo.id;
      for(let day=start;day<=end;day++) overflow[day].add(id);
      return [];
    }
    rows[row].push(item);
    return [{item,start,end,row}];
  });
  return {visible,overflow:overflow.map(items=>items.size)};
}

export function monthWeekItems(items:MonthItem[],week:string[],condensed:boolean){
 const count=items.filter(item=>item.end>=week[0]&&item.start<=week[6]).length;
 const layout=weekItems(items,week,condensed?3:Math.max(1,count));
 return {...layout,rowCount:Math.max(1,...layout.visible.map(item=>item.row+1))};
}
