"use client";

import { useState } from "react";
import { iherbProductId,supplementFactUnits,supplementLabelSchema,supplementServingUnits,type SupplementLabel } from "@/lib/supplement-label";
import { Input,Select } from "./forms";

const unitOptions=Object.fromEntries(supplementFactUnits.map(unit=>[unit,unit]));
const servingOptions=Object.fromEntries(supplementServingUnits.map(unit=>[unit,unit]));
const decimal=/^\d+(?:\.\d+)?$/;

export function SupplementLabelEditor({url,label,onApply}:{url:string;label?:SupplementLabel;onApply:(label:SupplementLabel)=>void}){
  const [servingSize,setServingSize]=useState(String(label?.servingSize??1));
  const [servingUnit,setServingUnit]=useState(label?.servingUnit??"정");
  const [rows,setRows]=useState(()=>label?.facts.map((fact,id)=>({id,name:fact.name,amount:String(fact.amount),unit:fact.unit,dailyValuePercent:fact.dailyValuePercent}))??[
    {id:0,name:"",amount:"",unit:"mg" as const,dailyValuePercent:null},
  ]);
  const [nextId,setNextId]=useState(rows.length);
  const [message,setMessage]=useState("");
  type Row=(typeof rows)[number];
  function update(id:number,patch:Partial<Row>){
    setRows(old=>old.map(row=>row.id===id?{...row,...patch,dailyValuePercent:null}:row));
    setMessage("");
  }
  function apply(){
    if(!decimal.test(servingSize.trim())||rows.some(row=>!row.name.trim()||!decimal.test(row.amount.trim()))){
      setMessage("각 성분의 이름과 함량을 입력해 주세요.");
      return;
    }
    const parsed=supplementLabelSchema.safeParse({productId:iherbProductId(url)??undefined,servingSize:Number(servingSize),servingUnit,
      facts:rows.map(({name,amount,unit,dailyValuePercent})=>({name,amount:Number(amount),unit,dailyValuePercent}))});
    if(!parsed.success){
      setMessage("제공량, 중복 성분과 각 성분의 함량을 확인해 주세요.");
      return;
    }
    onApply(parsed.data);
    setMessage("성분표를 입력했어요. 아래 복용 계획 저장을 눌러 완료해 주세요.");
  }
  return <details className="dose-product-details">
    <summary>{label?"성분표 수정":"라벨 성분표 직접 입력"}</summary>
    <p className="muted">제품 라벨에 적힌 1회 제공량과 각 성분의 함량을 입력해 주세요.</p>
    <div className="form-grid">
      <Input label="1회 제공량" value={servingSize} onChange={v=>{setServingSize(v);setMessage("");}}/>
      <Select label="제공량 단위" value={servingUnit} options={servingOptions} onChange={v=>{setServingUnit(v as typeof servingUnit);setMessage("");}}/>
    </div>
    {rows.map((row,index)=><div className="form-grid" key={row.id}>
      <Input label={`성분 ${index+1} 이름`} value={row.name} onChange={name=>update(row.id,{name:name.slice(0,120)})}/>
      <Input label={`성분 ${index+1} 함량`} value={row.amount} onChange={amount=>update(row.id,{amount})}/>
      <Select label={`성분 ${index+1} 단위`} value={row.unit} options={unitOptions} onChange={unit=>update(row.id,{unit:unit as Row["unit"]})}/>
      <button type="button" className="text-link" disabled={rows.length===1} onClick={()=>{setRows(old=>old.filter(r=>r.id!==row.id));setMessage("");}}>성분 삭제</button>
    </div>)}
    <div className="dialog-actions">
      <button type="button" className="button secondary" disabled={rows.length>=80} onClick={()=>{setRows(old=>[...old,{id:nextId,name:"",amount:"",unit:"mg",dailyValuePercent:null}]);setNextId(nextId+1);setMessage("");}}>성분 추가</button>
      <button type="button" className="button secondary" onClick={apply}>성분표 반영</button>
    </div>
    {message&&<p role="status">{message}</p>}
  </details>;
}
