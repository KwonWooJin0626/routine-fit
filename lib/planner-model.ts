import { z } from "zod";
import { effectTypes } from "./pet-model";

export const plannerCategories={study:"학업·수업",work:"일·과외·알바",task:"과제",meal:"식사",growth:"자기 개발",exercise:"운동",social:"약속",rest:"휴식"} as const;
export const plannerColors={study:215,work:4,task:270,meal:35,growth:164,exercise:187,social:326,rest:225} as const;
const categoryHue=z.number().int().min(0).max(359).optional();
export const plannerCategoryColorsSchema=z.object({study:categoryHue,work:categoryHue,task:categoryHue,meal:categoryHue,growth:categoryHue,exercise:categoryHue,social:categoryHue,rest:categoryHue}).strict();
export const plannerDateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(`${v}T12:00:00Z`);return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;},"올바른 날짜를 선택해주세요.");
const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const blockFields={mentalSource:z.enum(["user","template","default","unknown"]).optional(),physicalSource:z.enum(["user","template","default","unknown"]).optional(),groupId:z.string().min(1).max(50).optional(),title:z.string().trim().min(1).max(60),category:z.enum(["study","work","task","meal","growth","exercise","social","rest"]),petActivity:z.enum(effectTypes).optional(),location:z.string().trim().max(100),task:z.string().trim().max(300),start:time,end:time,mental:z.number().int().min(1).max(5),physical:z.number().int().min(1).max(5),shade:z.number().int().min(1).max(3),breakStart:time.optional(),breakEnd:time.optional()};
export const plannerBlockSchema=z.object({id:z.string().min(1).max(50),todoId:z.string().min(1).max(50).optional(),...blockFields,kind:z.enum(["fixed","once"]),date:plannerDateSchema,weekdays:z.array(z.number().int().min(0).max(6)).max(7),until:plannerDateSchema.optional(),excludedDates:z.array(plannerDateSchema).max(90).default([])}).superRefine((v,c)=>{
  if(v.start===v.end)c.addIssue({code:"custom",message:"시작과 종료시간을 다르게 입력해주세요."});
  if(v.kind==="fixed"&&!v.weekdays.length)c.addIssue({code:"custom",message:"반복할 요일을 하나 이상 선택해주세요."});
  if(v.until&&v.until<v.date)c.addIssue({code:"custom",message:"반복 종료일을 시작일 이후로 선택해주세요."});
  if(!!v.breakStart!==!!v.breakEnd)c.addIssue({code:"custom",message:"쉬는 시간의 시작과 종료를 모두 입력해주세요."});
  if(v.breakStart&&v.breakEnd){const min=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3));const offset=(t:string)=>(min(t)-min(v.start)+1440)%1440;const end=offset(v.end);if(offset(v.breakStart)<=0||offset(v.breakEnd)>=end||offset(v.breakEnd)<=offset(v.breakStart))c.addIssue({code:"custom",message:"쉬는 시간은 일정 내부에 배치해주세요."});}
});
export const plannerTemplateSchema=z.object({id:z.string().min(1).max(50),...blockFields});
export const occurrenceRecordSchema=z.object({blockId:z.string().min(1).max(50),date:plannerDateSchema,status:z.enum(["done","partial","skipped"]),title:z.string().max(60),start:time,end:time,recordedAt:z.string().datetime()});
export const plannerTodoSchema=z.object({
  id:z.string().min(1).max(50),title:z.string().trim().min(1,"할 일 제목을 입력해주세요.").max(60),
  status:z.enum(["open","done"]).default("open"),category:z.enum(["study","work","task","meal","growth","exercise","social","rest"]).optional(),
  dueDate:plannerDateSchema.optional(),todayDate:plannerDateSchema.optional(),estimate:z.number().int().min(5).max(720).optional(),
  location:z.string().trim().max(100).default(""),notes:z.string().max(1000).default(""),
  checklist:z.array(z.object({id:z.string().min(1).max(50),text:z.string().trim().min(1).max(100),done:z.boolean()})).max(30).default([]),
  completedAt:z.string().datetime().optional(),
}).superRefine((v,c)=>{if(new Set(v.checklist.map(x=>x.id)).size!==v.checklist.length)c.addIssue({code:"custom",message:"세부 할 일 ID가 중복됐어요."});});
export const plannerSchema=z.object({categoryColors:plannerCategoryColorsSchema.optional(),setupComplete:z.boolean(),blocks:z.array(plannerBlockSchema).max(180),templates:z.array(plannerTemplateSchema).max(100),records:z.array(occurrenceRecordSchema).max(1000).optional(),todos:z.array(plannerTodoSchema).max(200).optional()}).superRefine((v,c)=>{for(const rows of [v.blocks,v.templates])if(new Set(rows.map(r=>r.id)).size!==rows.length)c.addIssue({code:"custom",message:"중복된 블록이 있어요."});if(new Set((v.records??[]).map(r=>`${r.blockId}:${r.date}`)).size!==(v.records??[]).length)c.addIssue({code:"custom",message:"같은 일정의 수행 기록이 중복됐어요."});if(new Set((v.todos??[]).map(t=>t.id)).size!==(v.todos??[]).length)c.addIssue({code:"custom",message:"중복된 할 일이 있어요."});if(v.blocks.some(b=>b.todoId&&!v.todos?.some(t=>t.id===b.todoId)))c.addIssue({code:"custom",message:"일정에 연결한 할 일을 찾을 수 없어요."});});
export type PlannerTodo=z.infer<typeof plannerTodoSchema>;
export type Planner=z.infer<typeof plannerSchema>;
export type PlannerBlock=z.infer<typeof plannerBlockSchema>;
export type PlannerTemplate=z.infer<typeof plannerTemplateSchema>;
export const emptyPlanner=():Planner=>({setupComplete:false,blocks:[],templates:[]});
