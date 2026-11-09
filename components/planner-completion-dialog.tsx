"use client";
import { useState } from "react";
import { Check, PawPrint } from "lucide-react";
import { Dialog,Select } from "./forms";
import { effectLabels,type EffectType,type PetCommand,type PetDocument } from "@/lib/pet-model";
import { executionMinutes } from "@/lib/pet-execution";
import { petTime } from "@/lib/pet-guidance";
import type { ExecutionDraft } from "./execution-confirm-dialog";

export function PlannerCompletionDialog({draft,document,companion=true,busy,onSave,onDetailed,onLater,onClose}:{draft:ExecutionDraft;document:PetDocument;companion?:boolean;busy:boolean;onSave:(c:PetCommand)=>Promise<void>;onDetailed:(partial?:boolean)=>void;onLater:()=>Promise<void>;onClose:()=>void}){
  const [type,setType]=useState<EffectType>(draft.type),[fullness,setFullness]=useState<30|60|80>(),[error,setError]=useState("");
  const times=draft.planned!,minutes=Math.round(executionMinutes(times));
  const future=Date.parse(times.end)>Date.now(),tooOld=Date.parse(times.end)<Date.parse(document.seed.at);
  const save=async()=>{try{
    setError("");if(future)throw Error("아직 예정 종료 전이에요. 실제로 마친 시각을 직접 입력해주세요.");
    if(type==="meal"&&!fullness)throw Error("실제로 먹은 식사량을 선택해주세요.");
    await onSave({action:"record",record:{source:draft.source,title:draft.title,type,status:"done",intensity:"moderate",...(type==="meal"?{start:times.end,end:times.end,fullness}:times)}});onClose();
  }catch(e){setError((e as Error).message);}};
  return <Dialog title="작은 실천 하나, 함께 기록해요" subtitle="예정된 시간을 실제로 수행했는지 확인해요. 체크만 남기고 나중에 확인해도 돼요." onClose={()=>{if(!busy)onClose();}}>
    <div className="pet-quick-completion"><div className="pet-quick-title"><PawPrint size={24}/><div><h3>{draft.title}</h3><p>{petTime(times.start)} ~ {petTime(times.end)}</p><small>{minutes}분{times.breaks?.length?" · 쉬는 시간 제외":""} · 이번 날짜의 일정만 반영</small></div></div>
    <Select label="실제로 한 활동 종류" value={type} options={effectLabels} onChange={v=>setType(v as EffectType)}/>
    {type==="meal"&&<fieldset><legend>실제로 먹은 식사량</legend><div className="choice-buttons">{([[30,"가볍게"],[60,"보통"],[80,"든든하게"]] as const).map(([n,label])=><button type="button" key={n} disabled={busy} aria-pressed={fullness===n} onClick={()=>setFullness(n)}>{label}</button>)}</div></fieldset>}
    <p className="pet-rule-note">{type==="work"?"업무를 마친 노력도 실천으로 쌓여요. 게임 속 피로와 스트레스가 늘었다면 휴식으로 이어가요.":type==="none"?"일상을 챙긴 실천으로 기록돼요. 운동·학습 XP와는 별도로 나의 노력에 남아요.":companion?"실제 수행을 확인하면 강아지가 기뻐하고, 활동에 맞게 상태와 경험치를 반영해요.":"실제 수행 시간은 내 활동 기록과 생활패턴 분석에 반영해요. 강아지 입양은 선택이에요."} 연결된 루틴이 있다면 같은 활동으로 한 번만 반영해요.</p>
    {future&&<p className="note">아직 예정 종료 전이에요. 이미 마쳤다면 ‘시간·활동 직접 입력’에서 실제 시각을 알려주세요.</p>}
    {!tooOld&&Date.parse(times.start)<Date.parse(document.seed.at)&&<p className="note">실제 수행 시간은 모두 기록하고, 강아지 경험치는 함께 시작한 시각 이후의 분량만 반영해요.</p>}
    {tooOld&&<p className="note">강아지의 현재 기록 기간 이전 일정이에요. 완료 체크만 남기거나 실제 시각을 확인해주세요.</p>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="pet-form-actions"><button type="button" className="button primary" disabled={busy||future||tooOld||(type==="meal"&&!fullness)} onClick={()=>void save()}><Check size={16}/>{busy?"저장 중…":type==="meal"?"식사했어요 · 반영":"예정대로 했어요 · 반영"}</button><button type="button" className="button secondary" disabled={busy} onClick={()=>onDetailed(true)}>일부 했어요</button></div>
    <div className="pet-quick-links"><button type="button" className="text-link" disabled={busy} onClick={()=>onDetailed()}>시간·활동 직접 입력</button><button type="button" className="text-link" disabled={busy} onClick={async()=>{try{await onLater();onClose();}catch(e){setError((e as Error).message);}}}>체크만 저장 · 시간은 나중에</button></div>
    <small className="muted">‘예정대로 했어요’는 위 시간을 실제로 수행했다는 확인이에요. 취소·수정하면 연결된 상태도 다시 계산해요.</small></div>
  </Dialog>;
}
