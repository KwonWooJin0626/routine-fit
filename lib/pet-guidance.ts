import type { Answers,Routine } from "./model";
import type { PlannerBlock } from "./planner-model";
import { sourceKey,type PetDocument,type PetSource,type EffectType } from "./pet-model";

export function routineEffect(r:Routine,_answers:Answers):EffectType{
  if(r.activity?.id==="prepare")return "none";
  if(r.activity){const d=r.activity.domain;if(d==="exercise")return "exercise";if(d==="study")return "study";if(d==="reading")return "leisure";if(d==="rest")return "rest";if(d==="language"||d==="career")return "growth";}
  return r.category==="move"?"exercise":r.category==="sleep"?"rest":"none";
}
export function blockEffect(b:PlannerBlock):EffectType{return ({study:"study",work:"work",task:"study",meal:"meal",growth:"growth",exercise:"exercise",social:"social",rest:"rest"} as const)[b.category];}
export const executionFor=(doc:PetDocument|null|undefined,s:PetSource)=>doc?.records.find(r=>!r.cancelled&&r.sources.some(v=>sourceKey(v)===sourceKey(s)));
export const petTime=(iso:string)=>new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(iso));
export function koreanInput(iso:string){return new Date(Date.parse(iso)+9*3600000).toISOString().slice(0,16);}
export function inputISO(value:string){return new Date(`${value}:00+09:00`).toISOString();}
