"use client";
import { useState } from "react";
import { allergenLabels,nutritionProfileSchema,type NutritionProfile } from "@/lib/nutrition-profile";
import { ChoiceButtons } from "./choice-buttons";
import { QuestionFrame } from "./question-frame";
import { Input } from "./forms";
export function NutritionSurvey({initial,busy,onSave,onClose}:{initial:NutritionProfile;busy:boolean;onSave:(p:NutritionProfile)=>Promise<void>;onClose:()=>void}){
  const [p,set]=useState(initial),[step,setStep]=useState(0),[error,setError]=useState(""),[page,setPage]=useState(0);
  const update=(patch:Partial<NutritionProfile>)=>set(s=>({...s,...patch,reviewed:false}));
  const titles=["음식 알레르기가 있나요?","반응하는 원료를 골라주세요","유제품을 먹었을 때 소화는 어떤가요?","다른 음식에서 불편함이 있나요?","피하거나 먹기 어려운 음식이 있나요?","식사로 단백질을 어떻게 챙기나요?"];
  const next=async()=>{if(step<5){setStep(s=>s===0&&p.allergyStatus!=="known"?2:s+1);return;}const result=nutritionProfileSchema.safeParse({...p,reviewed:true});if(!result.success){setError(result.error.issues[0].message);return;}try{await onSave(result.data);onClose();}catch(e){setError((e as Error).message);}};
  return <QuestionFrame step={step} total={6} title={titles[step]} hint="식품 예시와 제품 비교 전 필요한 정보예요. 모르는 내용은 ‘없음’으로 처리하지 않아요." onClose={onClose} onBack={step?()=>setStep(s=>s===2&&p.allergyStatus!=="known"?0:s-1):undefined} onNext={()=>void next()} busy={busy} error={error} nextLabel={step===5?"확인한 정보 저장":"다음"} disabled={step===1&&!p.allergens.length}>
    {step===0&&<ChoiceButtons label="음식 알레르기" value={p.allergyStatus} options={{none:"없어요",known:"있어요",unknown:"잘 모르겠어요"}} onChange={v=>update({allergyStatus:v as NutritionProfile["allergyStatus"],allergens:v==="known"?p.allergens:[],allergyNotes:""})}/>}
    {step===1&&<><div className="supplement-choice-grid">{Object.entries(allergenLabels).slice(page*6,page*6+6).map(([key,label])=><button type="button" key={key} aria-pressed={p.allergens.includes(key as never)} onClick={()=>update({allergens:p.allergens.includes(key as never)?p.allergens.filter(x=>x!==key):[...p.allergens,key as never]})}>{label}</button>)}</div><div className="supplement-pagination"><button type="button" disabled={page===0} onClick={()=>setPage(0)}>이전 원료</button><span>{page+1} / 2</span><button type="button" disabled={page===1} onClick={()=>setPage(1)}>다음 원료</button></div><Input label="기타·반응 설명 (선택)" value={p.allergyNotes} onChange={v=>update({allergyNotes:v.slice(0,250)})}/></>}
    {step===2&&<ChoiceButtons label="우유·유제품의 소화 반응" value={p.lactose} options={{comfortable:"특별히 불편하지 않아요",discomfort:"복통·가스·설사 등이 있어요",unknown:"잘 모르겠어요"}} onChange={v=>update({lactose:v as NutritionProfile["lactose"]})}/>}
    {step===3&&<Input label="음식과 불편했던 반응 (선택)" value={p.digestiveNotes} placeholder="모르면 비워두세요" onChange={v=>update({digestiveNotes:v.slice(0,250)})}/>}
    {step===4&&<Input label="피하는 음식 (선택)" value={p.avoidFoods} onChange={v=>update({avoidFoods:v.slice(0,250)})}/>}
    {step===5&&<ChoiceButtons label="평소 단백질 식품 섭취" value={p.proteinIntake} options={{unknown:"얼마나 먹는지 몰라요",adequate:"식사로 충분히 챙겨요",difficult:"챙겨 먹기 어려워요"}} onChange={v=>update({proteinIntake:v as NutritionProfile["proteinIntake"]})}/>}
  </QuestionFrame>;
}
