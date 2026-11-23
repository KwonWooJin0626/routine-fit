"use client";
import { useState } from "react";
import { PawPrint,Plus,Sparkles,Utensils,Settings,Eye,Heart } from "lucide-react";
import { localDate } from "@/lib/model";
import { effectLabels,PET_FULLNESS_DECAY_PER_MINUTE,type EffectType,type PetCommand,type PetResult,type PetExecution } from "@/lib/pet-model";
import { petActivityRates,petIntensityFactors } from "@/lib/pet-engine";
import { executionMinutes } from "@/lib/pet-execution";
import { petTime } from "@/lib/pet-guidance";
import { PetAnimator } from "./pet-animator";
import { Dialog,Input,Toggle } from "./forms";
import type { ExecutionDraft } from "./execution-confirm-dialog";

type Props={pet:PetResult|null;busy:boolean;error:string;loading:boolean;onCommand:(c:PetCommand)=>Promise<void>;onRecord:(d:ExecutionDraft)=>void;onCheckin:()=>void;onSettings:()=>void};

const timedActivities=["exercise","study","work","growth","social","sleep","rest","leisure","none"] as const satisfies readonly EffectType[];
const factors=[1,2,4];
const signed=(value:number)=>value>0?`+${value}`:String(value);

function PetActivityRules(){
  return <details className="panel pet-history">
    <summary><PawPrint size={17}/>활동별 강아지 변화</summary>
    <p className="pet-rule-note">일정에서 실제 수행을 확인하면 선택한 활동과 시간에 따라 반영돼요. 아래 수치는 보통 강도 기준이에요.</p>
    <div className="record-table" role="region" aria-label="시간별 체력과 스트레스 변화" tabIndex={0}>
      <table>
        <thead><tr><th scope="col">활동</th><th scope="col">30분<br/>체력 / 스트레스</th><th scope="col">1시간<br/>체력 / 스트레스</th><th scope="col">2시간<br/>체력 / 스트레스</th><th scope="col">XP<br/>30분 / 1시간 / 2시간</th></tr></thead>
        <tbody>{timedActivities.map(type=>{
          const [stamina,stress,learning,fitness]=petActivityRates[type];
          const xp=learning||fitness;
          return <tr key={type}><th scope="row">{effectLabels[type]}</th>
            {factors.map(factor=><td key={factor}>{signed(stamina*factor)} / {signed(stress*factor)}</td>)}
            <td>{xp?`${fitness?"운동":"학습"} ${factors.map(factor=>signed(xp*factor)).join(" / ")}`:"—"}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <ul className="pet-rule-note">
      <li>체력 소모와 스트레스 증가에는 가벼움 ×{petIntensityFactors.light}, 보통 ×{petIntensityFactors.moderate}, 높음 ×{petIntensityFactors.high}이 적용돼요. 부담 점수가 있으면 실제 점수, 계획 점수 순으로 사용하고 1~5점은 각각 0.6·0.8·1·1.2·1.4배예요. XP는 실제 시간으로 계산해요.</li>
      <li>포만감은 분당 {PET_FULLNESS_DECAY_PER_MINUTE}점 줄어요. 식사를 기록하면 포만감이 30·60·80점 중 선택한 값으로 설정되고 스트레스가 최대 1점 줄어요.</li>
      <li>운동 XP는 한국 시간 기준 하루 최대 30이에요. 50 XP마다 최대 체력이 5점씩 늘어 150점까지 성장해요. 첫 학습 레벨업은 100 XP, 이후에는 레벨마다 필요 XP가 20씩 늘어요.</li>
      <li>활동 사이에는 시간당 체력 +0.5, 스트레스 −0.1을 하루 최대 6시간 적용해요. 자동 변화는 마지막 활동 이후 최대 24시간, 수면 회복은 하루 최대 9시간이에요.</li>
      <li>포만감이 30 이하이거나 스트레스가 80 이상이면 강아지가 쉬어요.</li>
    </ul>
  </details>;
}
export function PetHome({pet,busy,error,loading,onCommand,onRecord,onCheckin,onSettings}:Props){
  const [adopt,setAdopt]=useState(false),[name,setName]=useState("솜이"),[failure,setFailure]=useState("");
  const doc=pet?.document,v=pet?.view;
  if(!doc||!v)return <section className="pet-invite"><div className="pet-invite-image"><PetAnimator reducedMotion name="새 친구"/></div><div><span className="eyebrow">YOUR LITTLE COMPANION</span><h3>나의 작은 실천, 사모예드와 함께</h3><p>루틴은 그대로. 실제로 한 활동을 기록하며 빨간 스카프의 아기 사모예드와 자라요.</p>{error?<p role="alert">{error}</p>:<button className="button secondary" disabled={busy||loading} onClick={()=>setAdopt(true)}><PawPrint size={16}/>{loading?"친구를 확인하고 있어요…":"사모예드와 함께 시작"}</button>}<button className="text-link pet-solo-start" onClick={onCheckin}>오늘 컨디션 체크 · 루틴 만들기</button></div>{adopt&&<Dialog title="새 친구의 이름은 무엇인가요?" subtitle="선택 기능이에요. 건강 설문에 답을 더하지 않아도 시작할 수 있어요." onClose={()=>{if(!busy)setAdopt(false);}}><Input label="강아지 이름 (최대 20자)" value={name} onChange={setName}/><p className="pet-rule-note">체력·스트레스·성장은 게임 수치예요. 실제 건강 상태나 지능을 측정하지 않아요. 쉬거나 기록하지 않아도 실패하지 않아요.</p>{failure&&<p role="alert" className="form-error">{failure}</p>}<button className="button primary" disabled={busy||!name.trim()||name.length>20} onClick={async()=>{try{setFailure("");await onCommand({action:"adopt",name:name.trim()});setAdopt(false);}catch(e){setFailure((e as Error).message);}}}><Heart size={16}/>함께 시작하기</button></Dialog>}</section>;
  if(!doc.visible)return <section className="pet-invite pet-hidden"><PawPrint size={24}/><div><b>{doc.name}는 잠시 쉬고 있어요</b><p>기록은 유지돼요. 설정에서 언제든 다시 볼 수 있어요.</p></div><button className="button secondary" disabled={busy} onClick={()=>void onCommand({action:"settings",name:doc.name,visible:true,reducedMotion:doc.reducedMotion}).catch(()=>{})}><Eye size={16}/>다시 보기</button></section>;
  const record=(meal=false)=>onRecord({source:{kind:"manual",id:crypto.randomUUID(),date:localDate()},title:meal?"식사 기록":"오늘의 활동",type:meal?"meal":"rest",minutes:10});
  return <><section className="pet-home" aria-label="나의 사모예드"><div className="pet-home-copy"><div className="pet-home-heading"><span className="eyebrow"><PawPrint size={14}/>MY GROWTH COMPANION</span><button className="icon-button" aria-label="사모예드 설정" onClick={onSettings}><Settings size={17}/></button></div><h2>{doc.name}와 함께,<br/><em>작은 실천 하나.</em></h2><p>{v.baseState==="tired"?"지금은 편안하게 쉬고 있어요. 기록은 나의 속도로 남겨주세요.":"오늘의 작은 기록이 우리를 조금씩 자라게 해요."}</p><PetStats pet={pet}/><div className="pet-actions"><button className="button primary" disabled={busy} onClick={onCheckin}><Sparkles size={15}/>오늘 컨디션 체크</button><button className="button secondary" disabled={busy} onClick={()=>record(true)}><Utensils size={15}/>식사 기록</button><button className="button secondary" disabled={busy} onClick={()=>record()}><Plus size={15}/>활동</button></div><small>계획은 보상에 반영되지 않아요 · 실제 수행 확인 후 반영</small></div><div className="pet-home-art"><span className={`pet-mood ${v.baseState}`}>{v.baseState==="tired"?"편안히 쉬는 중":"꼬리 살랑, 함께하는 중"}</span><PetAnimator baseState={v.baseState} reactionId={pet?.reactionId} reducedMotion={doc.reducedMotion} name={doc.name}/><span className="pet-art-caption">SMALL STEPS, TOGETHER</span></div>{v.pausedByGap&&<p className="pet-away-note">오랜만이에요. 24시간 이후의 자동 변화는 멈춰 두었어요. 지금부터 다시 기록해도 괜찮아요.</p>}</section><PetActivityRules/></>;
}
function PetStats({pet}:{pet:PetResult}){const s=pet.view!.stats;return <div className="pet-stats">{[{label:"현재 체력",n:s.stamina,max:s.maxStamina,color:"#70a894"},{label:"스트레스",n:s.stress,max:100,color:"#c99a73"},{label:"포만감",n:s.fullness,max:100,color:"#e5686b"}].map(x=><div key={x.label}><span>{x.label}<b>{x.n.toFixed(1)}<small>/{x.max}</small></b></span><meter min={0} max={x.max} value={x.n} style={{"--pet-meter":x.color} as React.CSSProperties}>{Math.round(x.n)}</meter></div>)}</div>;}
export function PetHistory({pet,busy,onEdit,onCommand}:{pet:PetResult;busy:boolean;onEdit:(r:PetExecution)=>void;onCommand:(c:PetCommand)=>Promise<void>}){
  const [error,setError]=useState("");if(!pet.document||!pet.view)return null;const doc=pet.document,s=pet.view.stats;
  return <details className="panel pet-history"><summary><PawPrint size={17}/>{doc.name}의 성장과 실제 수행 기록 <span>학습 Lv.{s.learningLevel} · 운동 {Math.round(s.fitnessTotalXP)} XP</span></summary><div className="pet-growth"><div><b>운동 성장 {Math.round(s.fitnessXP)}/50 XP</b><p>50 XP마다 최대 체력 +5 · 하루 최대 30 XP</p></div><div><b>학습 Lv.{s.learningLevel} · {Math.round(s.learningXP)}/{100+20*(s.learningLevel-1)} XP</b><p>학업·자기계발 실천으로 차근차근</p></div></div><p className="pet-rule-note">모든 수치는 게임 안의 표현이에요. 건강·체력·지능의 실제 평가가 아닙니다. 식사·휴식·수면을 실제로 확인한 기록만 반영해요.</p>{error&&<p role="alert">{error}</p>}<div className="pet-record-list">{doc.records.filter(r=>!r.cancelled).sort((a,b)=>b.end.localeCompare(a.end)).map(r=>{const e=pet.view!.changes.find(x=>x.id===r.id);return <article key={r.id}><div><span className="category-label">{effectLabels[r.type]} · {petTime(r.end)}</span><h4>{r.title}</h4><p>{r.type==="meal"?`포만감 ${r.fullness}로 설정`:`실제 ${Math.round(executionMinutes(r))}분`}{e&&` · 운동 +${Math.round(e.fitnessXP)} XP · 학습 +${Math.round(e.learningXP)} XP · 체력 ${e.stamina>0?"+":""}${e.stamina.toFixed(1)} · 스트레스 ${e.stress>0?"+":""}${e.stress.toFixed(1)}`}</p>{e&&e.requestedFitnessXP>e.fitnessXP+.01&&<small>하루 운동 XP 상한을 적용했어요.</small>}<div className="pet-feelings"><span>마친 뒤 느낌</span>{([["fresh","개운해요"],["same","비슷해요"],["tired","피곤해요"]] as const).map(([value,label])=><button key={value} aria-pressed={r.feeling===value} disabled={busy} onClick={async()=>{try{setError("");await onCommand({action:"feeling",id:r.id,feeling:value});}catch(e){setError((e as Error).message);}}}>{label}</button>)}</div></div><button className="text-link" disabled={busy} onClick={()=>onEdit(r)}>수정·취소</button></article>;})}{!doc.records.some(r=>!r.cancelled)&&<p>아직 실제 수행 기록이 없어요. 완료할 때 실제 시간까지 확인하면 여기에 쌓여요.</p>}</div>{doc.archivedCount>0&&<p className="muted">90일 이전 {doc.archivedCount}건은 성장 요약으로 보관해요. 이전 원본은 수정할 수 없어요.</p>}</details>;
}
export function PetSettings({pet,busy,onCommand}:{pet:PetResult|null;busy:boolean;onCommand:(c:PetCommand)=>Promise<void>}){
  const doc=pet?.document,[name,setName]=useState(doc?.name??"솜이"),[visible,setVisible]=useState(doc?.visible??true),[reduced,setReduced]=useState(doc?.reducedMotion??false),[confirm,setConfirm]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState("");
  if(!doc)return <section className="panel"><h2>사모예드와 함께 성장하기</h2><p>‘오늘의 루틴’ 상단에서 사모예드와 함께 시작할 수 있어요.</p></section>;
  const run=async(c:PetCommand)=>{try{setError("");setNotice("");await onCommand(c);setNotice("강아지 설정을 저장했어요.");setConfirm("");}catch(e){setError((e as Error).message);}};
  return <section className="panel pet-settings"><h2><PawPrint size={20}/>나의 사모예드</h2><Input label="이름" value={name} onChange={setName}/><Toggle label="오늘의 루틴에서 강아지 표시" checked={visible} onChange={setVisible}/><Toggle label="애니메이션 줄이기" checked={reduced} onChange={setReduced} hint="기기에서 동작 줄이기를 켰다면 그 설정을 우선해요. 소리는 재생하지 않아요."/><button className="button secondary" disabled={busy||!name.trim()||name.length>20} onClick={()=>void run({action:"settings",name:name.trim(),visible,reducedMotion:reduced})}>강아지 설정 저장</button><details><summary>게임 규칙과 데이터 관리</summary><p>포만감은 1분마다 {PET_FULLNESS_DECAY_PER_MINUTE}씩 줄어요. 60점은 12분, 80점은 16분이 지나면 0이 돼요. 포만감 30 이하 또는 스트레스 80 이상이면 쉬어요. 미기록 구간의 자동 회복은 시간당 체력 +0.5·스트레스 −0.1, 하루 최대 6시간이에요.</p><p>운동 30분당 5 XP, 학업 10 XP, 자기계발 8 XP. 최대 체력이 성장해도 현재 체력을 즉시 채우지 않아요. 수면 회복은 한국 시간 하루 9시간까지 적용해요.</p><p>실제 수행 상세 기록은 최근 90일, 이전 기록은 성장 요약으로 보관해요. 전체 데이터 내보내기·초기화에도 포함돼요.</p><Input label="강아지만 새로 시작하려면 ‘강아지 새로 시작’ 입력" value={confirm} onChange={setConfirm}/><button className="button danger" disabled={busy||confirm!=="강아지 새로 시작"} onClick={()=>void run({action:"reset",confirm:"강아지 새로 시작"})}>강아지만 새로 시작</button><small>사람의 실제 활동·일정·루틴·수면 기록은 그대로 유지하고, 강아지의 성장만 새로 시작해요.</small></details>{error&&<p role="alert" className="form-error">{error}</p>}{notice&&<p role="status">{notice}</p>}</section>;
}
