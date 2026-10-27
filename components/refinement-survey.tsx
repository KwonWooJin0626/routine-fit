"use client";
import { useState } from "react";
import type { Answers } from "@/lib/model";
import { emptyBasicProfile, growthGoals } from "@/lib/basic-profile";
import { ChoiceButtons } from "./choice-buttons";
import { QuestionFrame } from "./question-frame";

export function RefinementSurvey({initial,busy,error,onComplete,onClose}:{initial:Answers;busy:boolean;error:string;onComplete:(a:Answers)=>void;onClose:()=>void}){
  const [a,set]=useState({...initial,basic:initial.basic??emptyBasicProfile()}),[step,setStep]=useState(0);
  const titles=["지금 가장 챙기고 싶은 것은 무엇인가요?","새 루틴에 어느 정도 시간을 쓸 수 있나요?","집중하기 편한 시간은 언제인가요?","루틴을 이어가기 어려운 이유는 무엇인가요?"];
  const hints=["목표에 맞는 루틴 주제를 고르는 데 사용해요.","이미 잡힌 일정 이외에 추가할 수 있는 시간이에요.","시간 선호이며, 실제 배치는 계획표의 빈 구간을 함께 확인해요.","루틴 분량과 쉬운 대안을 조정하는 데 사용해요."];
  return <QuestionFrame step={step} total={4} title={titles[step]} hint={hints[step]} onClose={onClose} onBack={step?()=>setStep(s=>s-1):undefined} onNext={()=>step<3?setStep(s=>s+1):onComplete(a)} busy={busy} error={error} nextLabel={step===3?"루틴 정밀화":"다음"}>
    {step===0&&<ChoiceButtons label="나의 관심 목표" value={a.basic.growthGoal} options={growthGoals} onChange={v=>set(p=>({...p,basic:{...p.basic,growthGoal:v as typeof p.basic.growthGoal}}))}/>}
    {step===1&&<ChoiceButtons label="하루 루틴 가능 시간" value={String(a.available)} options={{5:"5분",10:"10분",15:"15분",20:"20분",30:"30분",60:"60분"}} onChange={v=>set(p=>({...p,available:Number(v)}))}/>}
    {step===2&&<ChoiceButtons label="집중 시간 선호" value={a.basic.focusTime} options={{unknown:"잘 모르겠어요",morning:"오전",afternoon:"오후",evening:"저녁"}} onChange={v=>set(p=>({...p,basic:{...p.basic,focusTime:v as typeof p.basic.focusTime}}))}/>}
    {step===3&&<ChoiceButtons label="가장 큰 방해 요인" value={a.barrier} options={{time:"시간이 부족해요",tired:"피곤해요",forget:"잊어버려요",hard:"계획이 너무 어려워요",environment:"환경·일정이 자주 바뀌어요"}} onChange={v=>set(p=>({...p,barrier:v as Answers["barrier"]}))}/>}
  </QuestionFrame>;
}

const safetyItems=[
  ["conditions","현재 관리 중인 질환이 있나요?"],["medicines","현재 복용 중인 약이 있나요?"],["pregnancy","임신·수유 중이거나 임신을 준비 중인가요?"],["surgery","수술을 앞두고 있나요?"],["allergy","음식·약·영양제 알레르기가 있나요?"],
] as const;
export function SafetySurvey({initial,busy,error,onComplete,onClose}:{initial:Answers;busy:boolean;error:string;onComplete:(a:Answers)=>void;onClose:()=>void}){
  const [step,setStep]=useState(0),[values,set]=useState<Record<string,string>>({}),[confirmed,setConfirmed]=useState(false);
  return <QuestionFrame step={step} total={7} title={step<5?safetyItems[step][1]:step===5?"연령대를 확인할까요?":"확인한 정보로 영양 안내를 이어갈까요?"} hint={step<5?"제품을 비교하기 전에 필요한 확인이에요. 모르면 ‘잘 모르겠어요’를 선택하세요.":"이 확인만으로 모든 약물 상호작용이나 실제 상품의 안전성을 검사한 것은 아니에요."} onClose={onClose} onBack={step?()=>setStep(s=>s-1):undefined} busy={busy} error={error} disabled={step<5?!values[safetyItems[step][0]]:step===5?!values.age:!confirmed} nextLabel={step===6?"확인 정보 저장":"다음"} onNext={()=>{
    if(step<6){setStep(s=>s+1);return;}
    const patch=Object.fromEntries(safetyItems.map(([k])=>[k,values[k]==="yes"]));
    onComplete({...initial,...patch,...(values.age!=="unknown"?{age:values.age as Answers["age"]}:{}),...(initial.basic?{basic:{...initial.basic,nutritionAgeKnown:values.age!=="unknown"}}:{}),uncertainSafety:Object.values(values).includes("unknown"),safetyReviewed:true,supplementOptIn:true});
  }}>
    {step<5?<ChoiceButtons label="현재 상태" value={values[safetyItems[step][0]]??""} options={{no:"없어요",yes:"있어요",unknown:"잘 모르겠어요"}} onChange={v=>set(p=>({...p,[safetyItems[step][0]]:v}))}/>:step===5?<ChoiceButtons label="현재 연령대" value={values.age??""} options={{"18-29":"18~29세","30-39":"30~39세","40-49":"40~49세","50-64":"50~64세","65+":"65세 이상",unknown:"답하지 않을게요"}} onChange={age=>set(p=>({...p,age}))}/>:<><label className="check-choice"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>직접 답변을 확인했고, 일반적인 영양 정보 제공을 원해요.</label><p className="question-small">우려되는 조건이나 미확인 항목이 있으면 제품 연결을 보류해요. 음식 알레르기와 현재 제품의 함량도 별도로 확인해야 해요.</p></>}
  </QuestionFrame>;
}
