"use client";
import { useState } from "react";
import { plannerCategories,type Planner } from "@/lib/planner-model";
import { plannerPalette,plannerSwatch,type CategoryColors } from "@/lib/planner-colors";
import { Dialog,Select } from "./forms";

export function PlannerCategoryColors({planner,busy,onSave,onClose}:{planner:Planner;busy:boolean;onSave:(colors:CategoryColors)=>Promise<void>;onClose:()=>void}){
  const [colors,setColors]=useState<CategoryColors>(()=>({...planner.categoryColors}));
  const [saving,setSaving]=useState(false),[error,setError]=useState("");
  const locked=busy||saving;
  const save=async()=>{setSaving(true);setError("");try{await onSave(colors);onClose();}catch(e){setError(e instanceof Error?e.message:"색상을 저장하지 못했어요. 다시 시도해주세요.");}finally{setSaving(false);}};
  return <Dialog title="카테고리 색상 설정" subtitle="같은 카테고리의 모든 일정과 보관함 블록에 함께 적용돼요." wide onClose={()=>{if(!locked)onClose();}}>
    <form className="sp-colors-form" onSubmit={e=>{e.preventDefault();void save();}}>
      <p className="sp-colors-help">완료한 일정도 카테고리 색을 유지해요. 완료 여부는 체크와 취소선으로 구분해요.</p>
      <fieldset className="sp-color-fields" disabled={locked}>
        {(Object.keys(plannerCategories) as (keyof typeof plannerCategories)[]).map(category=><div key={category} className="sp-color-row">
          <span className="sp-color-samples" style={plannerSwatch(category,1,colors)} aria-hidden="true"><i/>{[1,2,3].map(shade=><b key={shade} style={plannerSwatch(category,shade,colors)}/>)}</span>
          <Select label={`${plannerCategories[category]} 색 계열`} value={colors[category]===undefined?"default":String(colors[category])} options={{default:"기본 색",...plannerPalette}} onChange={value=>setColors(previous=>{const next={...previous};if(value==="default")delete next[category];else next[category]=Number(value);return next;})}/>
        </div>)}
      </fieldset>
      {error&&<p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions sp-colors-actions"><button type="button" className="text-link" disabled={locked} onClick={()=>setColors({})}>모든 색 기본값으로</button><button type="button" className="button secondary" disabled={locked} onClick={onClose}>취소</button><button className="button primary" disabled={locked}>{locked?"저장 중…":"색상 저장"}</button></div>
    </form>
  </Dialog>;
}
