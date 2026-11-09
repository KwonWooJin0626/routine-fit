import { z } from "zod";
import { localDate,toMinutes,toTime,type AppState } from "./model";
import { addDate,weekday,occurrencesInWindow } from "./planner";
import { plannerDateSchema } from "./planner-model";

export class SupplementInputError extends Error {}
const id=z.string().regex(/^[a-zA-Z0-9_-]+$/).min(1).max(60),time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const iherbUrlSchema=z.string().max(1000).refine(value=>{if(!value)return true;try{const u=new URL(value);return u.protocol==="https:"&&(u.hostname==="iherb.com"||u.hostname.endsWith(".iherb.com"))&&!u.username&&!u.password&&!u.port;}catch{return false;}},"https 형식의 iHerb 주소만 입력해주세요.");
export const supplementProductSchema=z.object({
  id,name:z.string().trim().min(1,"제품명을 입력해주세요.").max(100),ingredients:z.array(z.string().trim().min(1).max(60)).max(24).default([]),
  dose:z.string().trim().max(80).default(""),url:iherbUrlSchema.default(""),notes:z.string().max(400).default(""),active:z.boolean().default(true),
  startDate:plannerDateSchema,endDate:plannerDateSchema.optional(),weekdays:z.array(z.number().int().min(0).max(6)).min(1).max(7),
  slots:z.array(z.object({id,anchor:z.enum(["fixed","breakfast","lunch","dinner","exercise","bed"]),time,offset:z.number().int().min(-180).max(180).default(0)})).min(1).max(6),
}).superRefine((v,c)=>{if(v.endDate&&v.endDate<v.startDate)c.addIssue({code:"custom",message:"종료일은 시작일 이후로 선택해주세요."});if(new Set(v.slots.map(s=>s.id)).size!==v.slots.length)c.addIssue({code:"custom",message:"복용 시간 ID가 중복됐어요."});if(new Set(v.weekdays).size!==v.weekdays.length)c.addIssue({code:"custom",message:"반복 요일이 중복됐어요."});});
export const supplementRecordSchema=z.object({
  id:z.string().min(1).max(150),productId:id,date:plannerDateSchema,slotId:id,status:z.enum(["taken","skipped","unknown"]),
  actualAt:z.string().datetime().nullable(),dose:z.string().trim().max(80),recordedAt:z.string().datetime(),updatedAt:z.string().datetime(),
  snapshot:z.object({name:z.string().min(1).max(100),ingredients:z.array(z.string().max(60)).max(24),plannedDose:z.string().max(80),plannedAt:z.string().datetime()}),
});
export const supplementJournalSchema=z.object({products:z.array(supplementProductSchema).max(40),records:z.array(supplementRecordSchema).max(6000)}).superRefine((v,c)=>{
  if(new Set(v.products.map(p=>p.id)).size!==v.products.length||new Set(v.records.map(r=>r.id)).size!==v.records.length)c.addIssue({code:"custom",message:"같은 제품이나 기록이 중복됐어요."});
});
export type SupplementProduct=z.infer<typeof supplementProductSchema>;
export type SupplementRecord=z.infer<typeof supplementRecordSchema>;
export type SupplementJournal=z.infer<typeof supplementJournalSchema>;
export const emptySupplementJournal=():SupplementJournal=>({products:[],records:[]});
export const supplementCommandSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("save"),product:supplementProductSchema}),
  z.object({action:z.literal("archive"),productId:id,active:z.boolean()}),
  z.object({action:z.literal("record"),productId:id,date:plannerDateSchema,slotId:id,status:z.enum(["taken","skipped","unknown"]),actualAt:z.string().datetime().optional(),dose:z.string().trim().max(80).optional()}),
  z.object({action:z.literal("clear"),recordId:z.string().min(1).max(150)}),
]);
export type SupplementCommand=z.infer<typeof supplementCommandSchema>;
export const supplementAnchors={fixed:"직접 정한 시각",breakfast:"아침 식사 후",lunch:"점심 식사 후",dinner:"저녁 식사 후",exercise:"운동 종료 후",bed:"취침 준비 전후"};
export const supplementStatus={taken:"복용했어요",skipped:"오늘은 건너뛰었어요",unknown:"기억나지 않아요"};
export function supplementSearch(query:string){return `https://kr.iherb.com/search?kw=${encodeURIComponent(query)}`;}
export function supplementIngredientQuery(id:string,query:string,app:AppState){
  if(id!=="protein")return query;
  if(app.nutrition?.allergens.includes("milk")||app.nutrition?.proteinSource==="plant"||app.answers.diet==="vegan")return app.nutrition?.allergens.includes("soy")?"rice protein":"plant protein";
  if(app.nutrition?.lactose==="discomfort")return "whey protein isolate lactose free";
  return query;
}
export function supplementOccurrenceId(productId:string,date:string,slotId:string){return `${productId}:${date}:${slotId}`;}
export function supplementPlannedAt(p:SupplementProduct,s:SupplementProduct["slots"][number],date:string,app?:AppState){
  let minutes=toMinutes(s.time);
  if(app&&s.anchor!=="fixed"){
    const rows=occurrencesInWindow(app.planner,date);
    if(s.anchor==="exercise"){const workouts=rows.filter(o=>o.block.category==="exercise");if(workouts.length)minutes=Math.max(...workouts.map(o=>o.until));}
    else if(s.anchor==="bed")minutes=toMinutes(app.schedule.bed);
    else{const match={breakfast:/아침|조식/,lunch:/점심|중식/,dinner:/저녁|석식/}[s.anchor];const meal=rows.find(o=>o.block.category==="meal"&&match.test(o.block.title));minutes=meal?meal.until:toMinutes(app.schedule[s.anchor]);}
  }
  minutes+=s.offset;const shift=Math.floor(minutes/1440),normalized=(minutes%1440+1440)%1440;
  return new Date(`${addDate(date,shift)}T${toTime(normalized)}:00+09:00`).toISOString();
}
export type SupplementOccurrence={id:string;product:SupplementProduct;slot:SupplementProduct["slots"][number];plannedAt:string;record?:SupplementRecord};
export function supplementOccurrences(j:SupplementJournal,date:string,app?:AppState):SupplementOccurrence[]{
  const result:SupplementOccurrence[]=[];
  for(const p of j.products){
    if(!p.active||date<p.startDate||p.endDate&&date>p.endDate||!p.weekdays.includes(weekday(date)))continue;
    for(const slot of p.slots){const key=supplementOccurrenceId(p.id,date,slot.id),record=j.records.find(r=>r.id===key);result.push({id:key,product:p,slot,plannedAt:record?.snapshot.plannedAt??supplementPlannedAt(p,slot,date,app),record});}
  }
  // Past facts survive renamed/paused products and removed schedule slots.
  for(const r of j.records.filter(r=>r.date===date&&!result.some(o=>o.id===r.id))){
    const p=j.products.find(p=>p.id===r.productId);if(!p)continue;
    result.push({id:r.id,product:{...p,name:r.snapshot.name,dose:r.snapshot.plannedDose,ingredients:r.snapshot.ingredients},slot:p.slots.find(s=>s.id===r.slotId)??{id:r.slotId,anchor:"fixed",time:"09:00",offset:0},plannedAt:r.snapshot.plannedAt,record:r});
  }
  return result.sort((a,b)=>a.plannedAt.localeCompare(b.plannedAt));
}
export function applySupplementCommand(j:SupplementJournal,input:SupplementCommand,app:AppState,now=new Date()):SupplementJournal{
  const next=structuredClone(j),today=localDate(now),cutoff=addDate(today,-89);
  if(input.action==="save"){
    const product=supplementProductSchema.parse(input.product),index=next.products.findIndex(p=>p.id===product.id);
    if(index<0){if(next.products.length>=40)throw new SupplementInputError("제품은 최대 40개까지 등록할 수 있어요. 기존 제품의 내용을 수정해주세요.");next.products.push(product);}else next.products[index]=product;
  }else if(input.action==="archive"){
    const p=next.products.find(p=>p.id===input.productId);if(!p)throw new SupplementInputError("등록한 제품을 찾을 수 없어요.");p.active=input.active;
  }else if(input.action==="clear")next.records=next.records.filter(r=>r.id!==input.recordId);
  else{
    if(input.date>today||input.date<cutoff)throw new SupplementInputError("최근 90일의 복용 사실만 기록할 수 있어요. 미래 날짜는 미리보기예요.");
    const key=supplementOccurrenceId(input.productId,input.date,input.slotId),old=next.records.find(r=>r.id===key),o=supplementOccurrences(next,input.date,app).find(o=>o.id===key);
    if(!o)throw new SupplementInputError("이 날짜의 복용 계획을 찾을 수 없어요.");
    if(input.status==="taken"&&input.date!==today&&!input.actualAt)throw new SupplementInputError("과거 복용은 실제 복용 시각을 입력해주세요.");
    const actualAt=input.status==="taken"?(input.actualAt??now.toISOString()):null;
    if(actualAt&&(Date.parse(actualAt)>now.getTime()||Math.abs(Date.parse(actualAt)-Date.parse(`${input.date}T12:00:00+09:00`))>36*3600000))throw new SupplementInputError("실제 복용 시각은 미래가 될 수 없으며 선택한 날짜와 36시간 이내여야 해요.");
    const record:SupplementRecord={id:key,productId:input.productId,date:input.date,slotId:input.slotId,status:input.status,actualAt,dose:input.status==="taken"?(input.dose??old?.dose??o.product.dose):"",recordedAt:old?.recordedAt??now.toISOString(),updatedAt:now.toISOString(),snapshot:old?.snapshot??{name:o.product.name,ingredients:o.product.ingredients,plannedDose:o.product.dose,plannedAt:o.plannedAt}};
    next.records=[...next.records.filter(r=>r.id!==key),record];
  }
  next.records=next.records.filter(r=>r.date>=cutoff);return supplementJournalSchema.parse(next);
}
