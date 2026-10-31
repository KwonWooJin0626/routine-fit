"use client";
import { useState } from "react";
import { Dialog,Input,Select } from "./forms";
import { effectLabels,type EffectType,type PetCommand,type PetDocument,type PetExecution,type PetSource } from "@/lib/pet-model";
import { calculatePet } from "@/lib/pet-engine";
import { inputISO,koreanInput,petTime } from "@/lib/pet-guidance";

export type ExecutionDraft={source:PetSource;title:string;type:EffectType;minutes:number;status?:"done"|"partial";existing?:PetExecution;start?:string;end?:string;fixedSleep?:boolean};
export function ExecutionConfirmDialog({draft,document,busy,onSave,onLater,onClose}:{draft:ExecutionDraft;document:PetDocument;busy:boolean;onSave:(command:PetCommand)=>Promise<void>;onLater?:()=>Promise<void>;onClose:()=>void}){
  const old=draft.existing,[initialEnd]=useState(()=>old?.end??draft.end??new Date().toISOString());
  const [title,setTitle]=useState(old?.title??draft.title),[type,setType]=useState<EffectType>(old?.type??draft.type),[minutes,setMinutes]=useState(String(old?Math.round((Date.parse(old.end)-Date.parse(old.start))/60000):draft.minutes||10));
  const [end,setEnd]=useState(koreanInput(initialEnd)),[start,setStart]=useState(koreanInput(old?.start??draft.start??new Date(Date.parse(initialEnd)-(draft.minutes||10)*60000).toISOString())),[useRange,setUseRange]=useState(!!draft.fixedSleep);
  const [fullness,setFullness]=useState<30|60|80|undefined>(old?.fullness),[intensity,setIntensity]=useState(old?.intensity??"moderate"),[linkTo,setLinkTo]=useState(""),[error,setError]=useState("");
  async function submit(){try{
    setError("");const finish=draft.fixedSleep?draft.end!:end===koreanInput(initialEnd)?initialEnd:inputISO(end),begin=type==="meal"?finish:draft.fixedSleep?draft.start!:useRange?inputISO(start):new Date(Date.parse(finish)-Number(minutes)*60000).toISOString();
    if(!title.trim())throw Error("활동 이름을 입력해주세요.");
    if(type==="meal"&&!fullness)throw Error("실제로 먹은 식사량을 선택해주세요.");
    if(type!=="meal"&&(!Number.isFinite(Date.parse(begin))||Date.parse(begin)>=Date.parse(finish)))throw Error("실제 수행 구간을 확인해주세요.");
    const record={title:title.trim(),type,start:begin,end:finish,intensity,fullness:type==="meal"?fullness:undefined,source:draft.source,status:draft.status??old?.status??"done",...(linkTo?{linkTo}:{})};
    await onSave(old?{action:"edit",id:old.id,record}:{action:"record",record});onClose();
  }catch(e){setError((e as Error).message);}}
  const choices=document.records.filter(r=>!r.cancelled&&r.type===type&&r.id!==old?.id);
  return <Dialog title={old?"실제 수행 기록 수정":"실제로 한 활동을 확인해요"} subtitle="예정 시간과 완료 체크만으로 성장 수치를 바꾸지 않아요." onClose={()=>{if(!busy)onClose();}}>
    <div className="pet-form"><Input label="활동 이름" value={title} onChange={setTitle}/>
    <Select label="어떤 활동이었나요?" value={type} options={effectLabels} onChange={v=>{if(!draft.fixedSleep)setType(v as EffectType);}}/>
    {draft.fixedSleep?<p className="note">직접 확인한 수면 구간: {petTime(draft.start!)} ~ {petTime(draft.end!)}. 시각 수정은 수면 체크인에서 해주세요.</p>:<>
      {type==="meal"?<><fieldset><legend>실제로 먹은 식사량</legend><div className="choice-buttons">{([[30,"가볍게 · 30"],[60,"보통 · 60"],[80,"든든하게 · 80"]] as const).map(([v,label])=><button type="button" key={v} aria-pressed={fullness===v} onClick={()=>setFullness(v)}>{label}</button>)}</div></fieldset><p className="pet-rule-note">포만감은 선택한 값으로 설정돼요. 30 이하이면 쉬는 표정이므로 ‘가볍게’는 잠깐 기뻐한 뒤 다시 쉬어요. 이 수치에 맞추려고 실제 식사량을 늘릴 필요는 없어요.</p></>:<><fieldset><legend>실제로 한 시간</legend><div className="choice-buttons">{[5,10,20,30,60,90].map(n=><button type="button" key={n} aria-pressed={!useRange&&minutes===String(n)} onClick={()=>{setUseRange(false);setMinutes(String(n));}}>{n}분</button>)}</div></fieldset><Input label="실제 수행 시간 (분)" type="number" min={1} max={1440} value={minutes} onChange={v=>{setUseRange(false);setMinutes(v);}}/><label className="pet-toggle"><input type="checkbox" checked={useRange} onChange={e=>setUseRange(e.target.checked)}/>시작·종료 시각으로 입력</label>{useRange&&<Input label="실제 시작 (한국 시간)" type="datetime-local" value={start} onChange={setStart}/>}<Select label="활동 강도" value={intensity} options={{light:"가볍게",moderate:"보통",high:"높게"}} onChange={v=>setIntensity(v as typeof intensity)}/></>}
      <Input label={type==="meal"?"실제 식사 시각 (한국 시간)":"실제 종료 시각 (한국 시간)"} type="datetime-local" value={end} onChange={setEnd}/>
    </>}
    {type==="sleep"&&!draft.fixedSleep&&<p className="note">확인한 실제 수면 구간을 입력해주세요. 취침 준비나 알람 설정 시각은 잠든 시각으로 보지 않아요.</p>}
    {type==="none"&&<p className="note">물 마시기·운동 준비 등은 생활 기록으로 남겨요. 운동·학습 XP는 받지 않아요.</p>}
    {type==="leisure"&&<p className="note">독서 목적이 학습이라면 ‘학업·공부’ 또는 ‘자기계발’을 선택해주세요. 다른 활동 중 들은 음악은 별도 휴식으로 중복 반영하지 않아요.</p>}
    {!old&&choices.length>0&&<details><summary>이미 기록한 같은 활동과 연결하기</summary><p>루틴과 계획표가 같은 실제 활동이라면 한 기록으로 연결해요. 시간·성장을 중복 반영하지 않아요.</p><Select label="연결할 실제 수행" value={linkTo} options={{"":"새로운 수행 기록",...Object.fromEntries(choices.map(r=>[r.id,`${r.title} · ${petTime(r.end)}`]))}} onChange={setLinkTo}/></details>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="pet-form-actions"><button className="button primary" disabled={busy} onClick={()=>void submit()}>{busy?"저장 중…":linkTo?"같은 활동으로 연결":"실제 수행으로 반영"}</button>{!old&&onLater&&<button className="button secondary" disabled={busy} onClick={async()=>{try{await onLater();onClose();}catch(e){setError((e as Error).message);}}}>시간은 나중에 · 체크만 저장</button>}{old&&<button className="button danger" disabled={busy} onClick={async()=>{try{await onSave({action:"cancel",id:old.id});onClose();}catch(e){setError((e as Error).message);}}}>이 수행 기록 취소</button>}</div>
    {type==="meal"&&fullness&&<p className="note">현재 포만감 {calculatePet(document).stats.fullness.toFixed(1)} → 식사 시각에 {fullness}로 설정. 이후 경과 시간만큼 다시 줄어요.</p>}
    <small className="muted">함께 시작한 {petTime(document.adoptedAt)} 이후 구간만 성장에 반영해요. 휴식이 섞였다면 수행한 구간만 나누어 기록해주세요. 수정·취소하면 이후 성장과 상태도 다시 계산해요.</small></div>
  </Dialog>;
}
