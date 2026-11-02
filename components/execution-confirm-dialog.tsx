"use client";
import { useState } from "react";
import { Dialog,Input,Select } from "./forms";
import { effectLabels,PET_FULLNESS_DECAY_PER_HOUR,type EffectType,type PetCommand,type PetDocument,type PetExecution,type PetSource } from "@/lib/pet-model";
import { calculatePet } from "@/lib/pet-engine";
import { inputISO,koreanInput,petTime } from "@/lib/pet-guidance";
import { executionMinutes } from "@/lib/pet-execution";

const durationPresets=[5,10,20,30,60,90];

export type ExecutionDraft={source:PetSource;title:string;type:EffectType;minutes:number;status?:"done"|"partial";existing?:PetExecution;start?:string;end?:string;fixedSleep?:boolean;detailed?:boolean;planned?:{start:string;end:string;breaks?:{start:string;end:string}[]}};
export function ExecutionConfirmDialog({draft,document,busy,onSave,onLater,onClose}:{draft:ExecutionDraft;document:PetDocument;busy:boolean;onSave:(command:PetCommand)=>Promise<void>;onLater?:()=>Promise<void>;onClose:()=>void}){
  const old=draft.existing,[initialEnd]=useState(()=>old?.end??draft.planned?.end??draft.end??new Date().toISOString());
  const [title,setTitle]=useState(old?.title??draft.title),[type,setType]=useState<EffectType>(old?.type??draft.type),[minutes,setMinutes]=useState(String(old?Math.round(executionMinutes(old)):draft.minutes||10));
  const [initialStart]=useState(()=>old?.start??draft.start??new Date(Date.parse(initialEnd)-(draft.minutes||10)*60000).toISOString());
  const [end,setEnd]=useState(koreanInput(initialEnd)),[start,setStart]=useState(koreanInput(initialStart)),[useRange,setUseRange]=useState(!!draft.fixedSleep||!!old?.breaks?.length);
  const [customMinutes,setCustomMinutes]=useState(()=>!durationPresets.includes(Number(minutes)));
  const [fullness,setFullness]=useState<30|60|80|undefined>(old?.fullness),[intensity,setIntensity]=useState(old?.intensity??"moderate"),[linkTo,setLinkTo]=useState(""),[error,setError]=useState("");
  async function submit(){try{
    setError("");const finish=draft.fixedSleep?draft.end!:end===koreanInput(initialEnd)?initialEnd:inputISO(end),begin=type==="meal"?finish:draft.fixedSleep?draft.start!:useRange?(start===koreanInput(initialStart)?initialStart:inputISO(start)):new Date(Date.parse(finish)-Number(minutes)*60000).toISOString();
    if(!title.trim())throw Error("활동 이름을 입력해주세요.");
    if(type==="meal"&&!fullness)throw Error("실제로 먹은 식사량을 선택해주세요.");
    if(type!=="meal"&&(!Number.isFinite(Date.parse(begin))||Date.parse(begin)>=Date.parse(finish)))throw Error("실제 수행 구간을 확인해주세요.");
    const breaks=type!=="meal"&&old?.breaks&&begin===old.start&&finish===old.end?old.breaks:undefined;
    const record={title:title.trim(),type,start:begin,end:finish,intensity,fullness:type==="meal"?fullness:undefined,breaks,source:draft.source,status:draft.status??old?.status??"done",...(linkTo?{linkTo}:{})};
    await onSave(old?{action:"edit",id:old.id,record}:{action:"record",record});onClose();
  }catch(e){setError((e as Error).message);}}
  const choices=document.records.filter(r=>!r.cancelled&&r.type===type&&r.id!==old?.id);
  return <Dialog title={old?"실제 수행 기록 수정":"실제로 한 활동을 확인해요"} subtitle="예정 시간과 완료 체크만으로 성장 수치를 바꾸지 않아요." onClose={()=>{if(!busy)onClose();}}>
    <div className="pet-form"><Input label="활동 이름" value={title} onChange={setTitle}/>
    <Select label="어떤 활동이었나요?" value={type} options={effectLabels} onChange={v=>{if(!draft.fixedSleep)setType(v as EffectType);}}/>
    {draft.fixedSleep?<p className="note">직접 확인한 수면 구간: {petTime(draft.start!)} ~ {petTime(draft.end!)}. 시각 수정은 수면 체크인에서 해주세요.</p>:<>
      {type==="meal"?<>
        <fieldset><legend>실제로 먹은 식사량</legend><div className="choice-buttons">{([[30,"가볍게 · 30"],[60,"보통 · 60"],[80,"든든하게 · 80"]] as const).map(([v,label])=><button type="button" key={v} aria-pressed={fullness===v} onClick={()=>setFullness(v)}>{label}</button>)}</div></fieldset>
        <p className="pet-rule-note">포만감은 선택한 값으로 설정되고 시간당 {PET_FULLNESS_DECAY_PER_HOUR}씩 줄어요. 저녁 6시에 가볍게 먹어도 다음 날 아침 7시에는 4가 남아요. 30 이하이면 쉬는 표정이므로 ‘가볍게’는 잠깐 기뻐한 뒤 다시 쉬어요. 이 수치에 맞추려고 실제 식사량을 늘릴 필요는 없어요.</p>
        <Input label="실제 식사 시각 (한국 시간)" type="datetime-local" value={end} onChange={setEnd}/>
      </>:<>
        <fieldset><legend>활동한 시간</legend>
          {!useRange&&<><div className="choice-buttons">{durationPresets.map(n=><button type="button" key={n} aria-pressed={!customMinutes&&minutes===String(n)} onClick={()=>{setCustomMinutes(false);setMinutes(String(n));}}>{n}분</button>)}<button type="button" aria-pressed={customMinutes} onClick={()=>setCustomMinutes(true)}>직접 입력</button></div>
          {customMinutes&&<Input label="분 단위로 직접 입력" type="number" min={1} max={1440} value={minutes} onChange={setMinutes}/>}</>}
          {useRange&&<p className="muted">아래 시작·종료 시각의 차이로 활동한 시간을 계산해요.</p>}
        </fieldset>
        <label className="pet-toggle"><input type="checkbox" checked={useRange} onChange={e=>setUseRange(e.target.checked)}/>시작·종료 시각으로 계산하기</label>
        {useRange&&<Input label="활동을 시작한 시각 (한국 시간)" type="datetime-local" value={start} onChange={setStart}/>}
        <Input label="활동을 마친 시각 (한국 시간)" type="datetime-local" value={end} onChange={setEnd}/>
        {!old&&draft.planned&&<small className="muted">계획표의 종료 시각을 기본으로 넣었어요. 실제로 마친 시각이 다르면 수정해주세요.{Date.parse(initialEnd)>Date.now()&&end===koreanInput(initialEnd)&&" 아직 예정 종료 전이라면 현재 이전의 실제 시각으로 수정해야 저장할 수 있어요."}</small>}
        <Select label="활동 강도" value={intensity} options={{light:"가볍게",moderate:"보통",high:"높게"}} onChange={v=>setIntensity(v as typeof intensity)}/>
      </>}
    </>}
    {old?.breaks?.length&&<p className="note">기록된 쉬는 시간 {old.breaks.map(b=>`${petTime(b.start)} ~ ${petTime(b.end)}`).join(" · ")}은 제외돼요. 시작·종료 시각을 바꾸거나 분량을 선택하면 쉬는 시간 없이 입력한 실제 구간으로 바뀌어요.</p>}
    {type==="sleep"&&!draft.fixedSleep&&<p className="note">확인한 실제 수면 구간을 입력해주세요. 취침 준비나 알람 설정 시각은 잠든 시각으로 보지 않아요.</p>}
    {type==="none"&&<p className="note">물 마시기·운동 준비 등은 생활 기록으로 남겨요. 운동·학습 XP는 받지 않아요.</p>}
    {type==="leisure"&&<p className="note">독서 목적이 학습이라면 ‘학업·공부’ 또는 ‘자기계발’을 선택해주세요. 다른 활동 중 들은 음악은 별도 휴식으로 중복 반영하지 않아요.</p>}
    {!old&&choices.length>0&&<details><summary>이미 기록한 같은 활동과 연결하기</summary><p>루틴과 계획표가 같은 실제 활동이라면 한 기록으로 연결해요. 시간·성장을 중복 반영하지 않아요.</p><Select label="연결할 실제 수행" value={linkTo} options={{"":"새로운 수행 기록",...Object.fromEntries(choices.map(r=>[r.id,`${r.title} · ${petTime(r.end)}`]))}} onChange={setLinkTo}/></details>}
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="pet-form-actions"><button className="button primary" disabled={busy} onClick={()=>void submit()}>{busy?"저장 중…":linkTo?"같은 활동으로 연결":draft.status==="partial"?"일부 수행으로 반영":"실제 수행으로 반영"}</button>{!old&&onLater&&<button className="button secondary" disabled={busy} onClick={async()=>{try{await onLater();onClose();}catch(e){setError((e as Error).message);}}}>시간은 나중에 · 체크만 저장</button>}{old&&<button className="button danger" disabled={busy} onClick={async()=>{try{await onSave({action:"cancel",id:old.id});onClose();}catch(e){setError((e as Error).message);}}}>이 수행 기록 취소</button>}</div>
    {type==="meal"&&fullness&&<p className="note">현재 포만감 {calculatePet(document).stats.fullness.toFixed(1)} → 식사 시각에 {fullness}로 설정. 이후 경과 시간만큼 다시 줄어요.</p>}
    <small className="muted">함께 시작한 {petTime(document.adoptedAt)} 이후 구간만 성장에 반영해요. 휴식이 섞였다면 수행한 구간만 나누어 기록해주세요. 수정·취소하면 이후 성장과 상태도 다시 계산해요.</small></div>
  </Dialog>;
}
