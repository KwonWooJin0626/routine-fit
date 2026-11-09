"use client";
import type { NutritionProfile } from "@/lib/nutrition-profile";
import { allergenLabels } from "@/lib/nutrition-profile";
import { Dialog } from "./forms";
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
export function SafetySurvey({initial,nutrition,busy,error,onComplete,onClose}:{nutrition?:NutritionProfile;initial:Answers;busy:boolean;error:string;onComplete:(a:Answers)=>void;onClose:()=>void}){
  const [values,set]=useState<Record<string,string>>(()=>({...initial.safetyResponses??Object.fromEntries([...safetyItems.map(([k])=>[k,initial.safetyReviewed?(initial[k]?"yes":initial.uncertainSafety?"unknown":"no"):"unknown"]),["age",initial.basic?.nutritionAgeKnown?initial.age:"unknown"]]),...(nutrition?.allergyStatus==="known"?{allergy:"yes"}:{})})),[confirmed,setConfirmed]=useState(false);
  const save=()=>{
    const patch=Object.fromEntries(safetyItems.map(([k])=>[k,values[k]==="yes"]));
    onComplete({...initial,...patch,safetyResponses:values,...(values.age!=="unknown"?{age:values.age as Answers["age"]}:{}),...(initial.basic?{basic:{...initial.basic,nutritionAgeKnown:values.age!=="unknown"}}:{}),uncertainSafety:Object.values(values).includes("unknown"),safetyReviewed:true,supplementOptIn:true});
  };
  return <Dialog title="저장된 안전 정보 확인" subtitle="기존 답변을 불러왔어요. 바뀐 내용만 수정하세요. 일반 성분 정보와 검색 링크는 별도로 이용할 수 있어요." onClose={onClose} wide>{nutrition?.allergyStatus==="known"&&<p className="note">저장한 식품 알레르기: {nutrition.allergens.map(k=>allergenLabels[k]).join(" · ")}. 식품·제품 비교에 같은 정보를 재사용해요.</p>}<div className="shared-safety-grid">{safetyItems.map(([key,label])=><ChoiceButtons key={key} label={label} value={values[key]??"unknown"} options={{no:"없어요",yes:"있어요",unknown:"미확인"}} onChange={v=>set(old=>({...old,[key]:v}))}/>)}</div><details className="optional-questions"><summary>연령 정보 확인</summary><ChoiceButtons label="현재 연령대" value={values.age??"unknown"} options={{"18-29":"18~29세","30-39":"30~39세","40-49":"40~49세","50-64":"50~64세","65+":"65세 이상",unknown:"미확인"}} onChange={age=>set(p=>({...p,age}))}/></details><p className="question-small">모르는 항목은 그대로 남겨요. 실제 상품의 원료·함량·약물 상호작용을 모두 검사하는 기능은 아니에요.</p><label className="check-choice"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>위 정보가 현재 상태와 맞는지 직접 확인했어요.</label>{error&&<p role="alert" className="form-error">{error}</p>}<div className="dialog-actions"><button type="button" className="button primary" disabled={busy||!confirmed} onClick={save}>변경 내용 저장</button></div></Dialog>;
}
