import { z } from "zod";

const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const sleepSettingsSchema=z.object({
  bed:time,wake:time,weekdays:z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(v=>new Set(v).size===v.length),
  timezone:z.literal("Asia/Seoul"),emailEnabled:z.boolean(),bedReference:z.enum(["checkin","alarm-setting"]),
}).refine(v=>v.bed!==v.wake,{message:"취침·기상 목표를 서로 다르게 선택해주세요."});
export type SleepSettings=z.infer<typeof sleepSettingsSchema>;
export type SleepRecord={id:string;sessionDate:string;kind:"bed"|"wake";plannedAt:string;checkedAt:string;actualAt:string|null;method:"web"|"email"|"alarm-setting";updatedAt:string};
export const sleepCheckinSchema=z.object({kind:z.enum(["bed","wake"]),token:z.string().min(40).max(500).optional(),actualAt:z.string().datetime().optional()});
export const sleepCorrectionSchema=z.object({id:z.string().min(1).max(100),actualAt:z.string().datetime().nullable()});
export const defaultSleepSettings=(bed="23:00",wake="07:00"):SleepSettings=>({bed,wake,weekdays:[0,1,2,3,4,5,6],timezone:"Asia/Seoul",emailEnabled:false,bedReference:"checkin"});
export function koreanDate(now:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);}
export function koreanTime(now:Date){return new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hour12:false}).format(now);}
export function shiftDate(date:string,days:number){const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function sleepSessionDate(kind:"bed"|"wake",now:Date,s:SleepSettings){const date=koreanDate(now);return kind==="bed"&&koreanTime(now)>=s.wake?shiftDate(date,1):date;}
export function plannedSleepTime(date:string,kind:"bed"|"wake",s:SleepSettings){const day=kind==="bed"&&s.bed>=s.wake?shiftDate(date,-1):date;return new Date(`${day}T${s[kind]}:00+09:00`).toISOString();}
export function dueSleepEvents(s:SleepSettings,now:Date){
  if(!s.emailEnabled)return [];
  const today=koreanDate(now),rows:{kind:"bed"|"wake";sessionDate:string;plannedAt:string}[]=[];
  for(const date of [shiftDate(today,-1),today,shiftDate(today,1)]){
    if(!s.weekdays.includes(new Date(`${date}T12:00:00Z`).getUTCDay()))continue;
    for(const kind of ["bed","wake"] as const){const plannedAt=plannedSleepTime(date,kind,s),late=now.getTime()-new Date(plannedAt).getTime();if(late>=0&&late<=10*60000)rows.push({kind,sessionDate:date,plannedAt});}
  }
  return rows;
}
export function validateActualAt(value:string|null,checkedAt:string,now:Date){
  if(value===null)return true;
  const actual=new Date(value).getTime(),checked=new Date(checkedAt).getTime();
  return Number.isFinite(actual)&&actual<=now.getTime()&&Math.abs(actual-checked)<=36*3600000;
}
