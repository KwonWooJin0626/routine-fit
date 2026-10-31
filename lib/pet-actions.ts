import type { AppState } from "./model";
import { localDate,toTime } from "./model";
import { occursOn } from "./planner";
import type { SleepRecord } from "./sleep";
import { calculatePet,compactPet,newPetDocument } from "./pet-engine";
import { PetError,sourceKey,type PetDocument,type PetExecution,type PetRequest,type PetSource } from "./pet-model";

export function relatedSources(app:AppState,source:PetSource):PetSource[]{
  if(source.kind==="planner")return [source,...(app.days.find(d=>d.date===source.date)?.routines.filter(r=>r.activity?.linkedEvent===`plan-${source.id}-${source.date}`).map(r=>({kind:"routine" as const,id:r.id,date:source.date}))??[])];
  if(source.kind!=="routine")return [source];
  const routine=app.days.find(d=>d.date===source.date)?.routines.find(r=>r.id===source.id);
  const block=app.planner?.blocks.find(b=>routine?.activity?.linkedEvent===`plan-${b.id}-${source.date}`);
  return [source,...(block?[{kind:"planner" as const,id:block.id,date:source.date}]:[])];
}
function validateSource(app:AppState,source:PetSource,type:string,sleep:SleepRecord[]){
  if(source.kind==="routine"){
    const routine=app.days.find(d=>d.date===source.date)?.routines.find(r=>r.id===source.id);
    if(!routine)throw new PetError("루틴을 다시 불러와주세요.",409);
    if(routine.held)throw new PetError("보류 중인 운동은 실행 보상에 연결하지 않아요.");
    if(routine.activity?.id==="prepare"&&type!=="none")throw new PetError("운동 준비 활동은 준비·생활 기록으로 남겨주세요.");
  }else if(source.kind==="planner"){
    const block=app.planner?.blocks.find(b=>b.id===source.id);
    if(!block||!occursOn(block,source.date))throw new PetError("해당 날짜의 일정을 다시 확인해주세요.",409);
  }else if(source.kind==="sleep"){
    if(type!=="sleep"||!sleep.some(r=>r.sessionDate===source.date&&r.kind==="bed"&&r.actualAt)||!sleep.some(r=>r.sessionDate===source.date&&r.kind==="wake"&&r.actualAt))throw new PetError("취침·기상 실제 시각을 먼저 확인해주세요.");
  }
}
export function projectPetRecords(app:AppState,doc:PetDocument):AppState{
  const next=structuredClone(app);
  for(const record of doc.records)for(const source of record.sources){
    if(source.kind==="routine"){
      const day=next.days.find(d=>d.date===source.date);
      if(day?.routines.some(r=>r.id===source.id)){
        if(record.cancelled){delete day.statuses[source.id];if(day.activityFeedback?.[source.id])day.activityFeedback[source.id]={...day.activityFeedback[source.id],actualMinutes:null,recordedAt:record.updatedAt};}
        else{day.statuses[source.id]=record.status;day.activityFeedback={...day.activityFeedback,[source.id]:{...day.activityFeedback?.[source.id],actualMinutes:Math.round((Date.parse(record.end)-Date.parse(record.start))/60000),recordedAt:record.updatedAt}};}
      }
    }
    if(source.kind==="planner"&&next.planner){
      const old=next.planner.records?.find(r=>r.blockId===source.id&&r.date===source.date),block=next.planner.blocks.find(b=>b.id===source.id);
      next.planner.records=(next.planner.records??[]).filter(r=>r.blockId!==source.id||r.date!==source.date);
      if(!record.cancelled&&(old||block))next.planner.records.push({blockId:source.id,date:source.date,status:record.status,title:old?.title??block?.title??record.title,start:old?.start??block?.start??toTime(0),end:old?.end??block?.end??toTime(1),recordedAt:record.updatedAt});
    }
  }
  return next;
}
export function protectsPetRecords(old:AppState,next:AppState,doc:PetDocument|null){
  if(!doc)return true;
  for(const r of doc.records.filter(r=>!r.cancelled))for(const source of r.sources){
    if(source.kind==="routine"){
      const before=old.days.find(d=>d.date===source.date),after=next.days.find(d=>d.date===source.date);
      if(before?.routines.some(r=>r.id===source.id)&&after?.routines.some(r=>r.id===source.id)&&after.statuses[source.id]!==r.status)return false;
      if(before?.routines.some(r=>r.id===source.id)&&after?.routines.some(r=>r.id===source.id)&&after.activityFeedback?.[source.id]?.actualMinutes!==before.activityFeedback?.[source.id]?.actualMinutes)return false;
    }
    if(source.kind==="planner"){
      const a=old.planner?.records?.find(v=>v.blockId===source.id&&v.date===source.date),b=next.planner?.records?.find(v=>v.blockId===source.id&&v.date===source.date);
      if(a&&b?.status!==r.status)return false;
    }
  }
  return true;
}
export function commandAlreadyApplied(doc:PetDocument|null,input:PetRequest){
  const receipt=doc?.receipts.find(r=>r.key===input.key);
  if(receipt&&receipt.hash!==JSON.stringify(input.command))throw new PetError("이미 사용한 요청 ID예요. 내용을 다시 확인해주세요.",409);
  return !!receipt;
}
export function applyPetCommand(old:PetDocument|null,app:AppState,input:PetRequest,now=new Date(),sleep:SleepRecord[]=[]):{document:PetDocument;app:AppState;reactionId?:string}{
  const cmd=input.command,at=now.toISOString();let doc=old?compactPet(structuredClone(old),now):null,changedId:string|undefined;
  if(cmd.action==="adopt"){
    if(doc)throw new PetError("이미 함께하는 강아지가 있어요.",409);
    doc=newPetDocument(cmd.name,input.key,now);
  }else{
    if(!doc)throw new PetError("먼저 강아지와 함께 시작해주세요.",409);
    if(cmd.action==="settings"){doc.name=cmd.name;doc.visible=cmd.visible;doc.reducedMotion=cmd.reducedMotion;}
    if(cmd.action==="reset")doc=newPetDocument(doc.name,input.key,now);
    if(cmd.action==="record"||cmd.action==="edit"){
      const v=cmd.record,start=Date.parse(v.start),end=Date.parse(v.end),earliest=Date.parse(doc.seed.at);
      if(end>now.getTime()||end<earliest||start>end||end-start>24*3600000||(v.type!=="meal"&&start===end)||(v.type==="meal"&&(start!==end||!v.fullness)))throw new PetError("실제 시각·분량을 확인해주세요. 최근 90일의 기록만 정정할 수 있어요.");
      if(v.source.date>localDate(now))throw new PetError("미래 계획은 실제 수행으로 반영할 수 없어요.");
      validateSource(app,v.source,v.type,sleep);
      if(v.source.kind==="sleep"){
        const bed=sleep.find(r=>r.sessionDate===v.source.date&&r.kind==="bed"),wake=sleep.find(r=>r.sessionDate===v.source.date&&r.kind==="wake");
        if(v.start!==bed?.actualAt||v.end!==wake?.actualAt)throw new PetError("수면 실제 시각을 새로 불러와주세요.",409);
      }
      const sources=relatedSources(app,v.source),oldRecord=cmd.action==="edit"?doc.records.find(r=>r.id===cmd.id&&!r.cancelled):undefined;
      if(cmd.action==="edit"&&!oldRecord)throw new PetError("수정할 기록이 없거나 보관 기간이 지났어요.",404);
      if(oldRecord&&!oldRecord.sources.some(s=>sourceKey(s)===sourceKey(v.source)))throw new PetError("원본 기록의 연결을 확인해주세요.",409);
      const linked=v.linkTo?doc.records.find(r=>r.id===v.linkTo&&!r.cancelled):undefined;
      if(v.linkTo&&!linked)throw new PetError("연결할 수행 기록을 다시 확인해주세요.",409);
      const occupied=doc.records.find(r=>!r.cancelled&&r.id!==oldRecord?.id&&r.id!==linked?.id&&r.sources.some(s=>sources.some(p=>sourceKey(p)===sourceKey(s))));
      if(occupied)throw new PetError("이 활동은 이미 반영했어요. 기존 기록을 수정하거나 연결해주세요.",409);
      if(linked){
        if(cmd.action!=="record"||linked.type!==v.type)throw new PetError("같은 종류의 실제 활동만 연결할 수 있어요.");
        linked.sources=[...linked.sources,...sources.filter(s=>!linked.sources.some(p=>sourceKey(p)===sourceKey(s)))];linked.updatedAt=at;
      }else{
        if(v.type!=="meal"&&doc.records.some(r=>!r.cancelled&&r.type!=="meal"&&r.id!==oldRecord?.id&&Date.parse(r.start)<end&&Date.parse(r.end)>start))throw new PetError("실제 수행 시간이 겹쳐요. 시간을 나누거나 같은 활동으로 연결해주세요.",409);
        const record:PetExecution={id:oldRecord?.id??input.key,title:v.title,type:v.type,start:v.start,end:v.end,intensity:v.intensity,fullness:v.type==="meal"?v.fullness:undefined,status:v.status,sources:oldRecord?.sources??sources,cancelled:false,feeling:oldRecord?.feeling??"same",updatedAt:at};
        doc.records=doc.records.filter(r=>r.id!==record.id);doc.records.push(record);changedId=record.id;
      }
    }
    if(cmd.action==="cancel"||cmd.action==="feeling"){
      const record=doc.records.find(r=>r.id===cmd.id&&!r.cancelled);
      if(!record)throw new PetError("해당 기록을 찾을 수 없어요.",404);
      if(cmd.action==="cancel")record.cancelled=true;else record.feeling=cmd.feeling;
      record.updatedAt=at;
    }
  }
  const view=calculatePet(doc,now),effect=view.changes.find(e=>e.id===changedId);
  const reactionId=cmd.action==="record"&&effect&&(effect.type==="meal"||effect.fitnessXP>0||effect.learningXP>0||effect.stamina>0)?input.key:undefined;
  doc.receipts=[...doc.receipts.filter(r=>r.key!==input.key),{key:input.key,hash:JSON.stringify(cmd)}].slice(-100);
  return {document:doc,app:projectPetRecords(app,doc),reactionId};
}
