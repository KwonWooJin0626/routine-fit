"use client";
import { useState } from "react";
import { localDate,type AppState } from "@/lib/model";
import { intakeStatus,nutrientKey,supplementIntake } from "@/lib/supplement-intake";
import type { SupplementJournal,SupplementProduct } from "@/lib/supplement-journal";
import { supplementServingUnits,type SupplementLabel } from "@/lib/supplement-label";
import { updateManualSupplementLabel } from "@/lib/supplement-manual-label";
import { Input } from "./forms";
import styles from "./supplement-intake-table.module.css";

const format=new Intl.NumberFormat("ko-KR",{maximumFractionDigits:3});

export function SupplementIntakeTable({journal,app,onSaveProduct,onEditProduct,busy=false}:{journal:SupplementJournal;app:AppState;onSaveProduct?:(product:SupplementProduct)=>Promise<void>;onEditProduct?:(id:string)=>void;busy?:boolean}){
  const [mode,setMode]=useState<"plan"|"actual">("plan"),[date,setDate]=useState(localDate);
  const [drafts,setDrafts]=useState<Record<string,{values:Record<string,string>;dose?:string;unit?:SupplementLabel["servingUnit"]}>>({});
  const [notice,setNotice]=useState("");
  const change=(id:string,patch:Partial<NonNullable<typeof drafts[string]>>)=>setDrafts(old=>({...old,[id]:{...(old[id]??{values:{}}),...patch}}));
  async function save(id:string){
    const product=journal.products.find(p=>p.id===id),draft=drafts[id];if(!product||!draft||!onSaveProduct)return;
    setNotice("");
    try{
      await onSaveProduct(updateManualSupplementLabel(product,draft.values,draft.unit??"정",draft.dose??product.dose));
      setDrafts(old=>{const next={...old};delete next[id];return next;});setNotice("직접 입력한 성분을 저장했어요. 입력하지 않은 칸은 미확인으로 남겨요.");
    }catch(e){setNotice((e as Error).message);}
  }
  const {columns,rows,totals,missingCount}=supplementIntake(journal,app,date,mode);
  return <section className={`panel ${styles.panel}`} aria-labelledby="intake-table-title">
    <header className={styles.header}>
      <div><h2 id="intake-table-title">1일 영양소 섭취표</h2><p>등록한 영양제에서 확인한 양 · 식사 제외</p></div>
      <Input label="섭취표 날짜" type="date" value={date} onChange={value=>{if(/^\d{4}-\d{2}-\d{2}$/.test(value))setDate(value);}}/>
    </header>
    <div className="space-tabs" role="group" aria-label="섭취 합계 방식">
      <button type="button" aria-pressed={mode==="plan"} onClick={()=>setMode("plan")}>복용 계획 기준</button>
      <button type="button" aria-pressed={mode==="actual"} onClick={()=>setMode("actual")}>실제 복용</button>
    </div>
    {missingCount>0&&<p className={styles.notice}>제품 {missingCount}개의 라벨 또는 복용량이 일부 확인되지 않았어요. 표에는 확인된 양만 표시해요.</p>}
    <p className={styles.notice}>- : 확인한 성분표에 표기 없음 · 빈칸 : 미확인. 직접 입력은 아래에 표시한 제공량 기준이며, 저장 후 복용량·횟수로 하루 합계를 계산해요.</p>
    {notice&&<p role="status">{notice}</p>}
    {rows.length>0?<div className={styles.scroll} role="region" aria-label="제품별 영양소 섭취량" tabIndex={0}>
      <table>
        <thead><tr><th scope="col">영양제</th>{columns.length?columns.map(column=><th key={nutrientKey(column)} scope="col">{column.name}<small>{column.unit}</small></th>):<th scope="col">성분표</th>}</tr></thead>
        <tbody>
          <tr><th scope="row">1일 확인 합계</th>{columns.length?columns.map(column=>{
            const key=nutrientKey(column),value=totals[key],status=intakeStatus(column,value,missingCount>0);
            return <td key={key} className={styles[status.level]} title={status.reference?`미국 라벨 기준치 ${status.reference} ${column.unit}`:undefined}>
              <b>{value===undefined?"—":format.format(value)}</b><small>{status.label}</small>
            </td>;
          }):<td>판정 보류</td>}</tr>
          {rows.map(row=><tr key={row.id}>
            <th scope="row">{row.name}<small>{row.occurrences}회{row.missing?" · 확인 필요":""}</small>{mode==="plan"&&row.unconfirmed&&onSaveProduct&&(()=>{
              const product=journal.products.find(p=>p.id===row.id);if(!product)return null;
              return <div className={styles.editor}><small>직접 입력 · {product.label?.servingSize??1}{product.label?.servingUnit??drafts[row.id]?.unit??"정"}당</small>
                {!product.label&&<label>단위<select aria-label={`${row.name} 제공량 단위`} value={drafts[row.id]?.unit??"정"} disabled={busy} onChange={e=>change(row.id,{unit:e.target.value as SupplementLabel["servingUnit"]})}>{supplementServingUnits.map(unit=><option key={unit}>{unit}</option>)}</select></label>}
                <label>1회 복용 개수<input aria-label={`${row.name} 1회 복용 개수`} inputMode="decimal" value={drafts[row.id]?.dose??product.dose} disabled={busy} onChange={e=>change(row.id,{dose:e.target.value})}/></label>
                {product.label?.facts.some(f=>f.manual)&&!drafts[row.id]&&<button type="button" className="text-link" disabled={busy} onClick={()=>change(row.id,{values:{}})}>함량 수정</button>}
                <button type="button" className="text-link" disabled={busy||!drafts[row.id]} onClick={()=>void save(row.id)}>입력 저장</button>
              </div>;
            })()}</th>
            {columns.length?columns.map(column=>{
              const key=nutrientKey(column),amount=row.amounts[key];
              const product=journal.products.find(p=>p.id===row.id),fact=product?.label?.facts.find(f=>nutrientKey(f)===key);
              const editable=mode==="plan"&&onSaveProduct&&row.unconfirmed&&(!row.knownKeys.includes(key)||(fact?.manual&&!!drafts[row.id]));
              if(editable)return <td key={key}><input className={styles.amountInput} type="text" inputMode="decimal" aria-label={`${row.name} ${column.name} ${column.unit} 직접 입력`} disabled={busy}
                value={drafts[row.id]?.values[key]??(fact?.manual?String(fact.amount):"")} onChange={e=>change(row.id,{values:{...drafts[row.id]?.values,[key]:e.target.value}})}/></td>;
              return <td key={key}>{amount!==undefined?`${format.format(amount)}${row.doseUnknown?" 이상":""}`:row.knownKeys.includes(key)?<button type="button" className="text-link" disabled={mode!=="plan"||!onEditProduct||busy} onClick={()=>onEditProduct?.(row.id)}>복용량 입력</button>:row.unconfirmed?"":"-"}</td>;
            }):<td>확인 필요</td>}
          </tr>)}
        </tbody>
      </table>
    </div>:<p className={styles.notice}>{mode==="plan"?"이 날짜에 등록된 복용 계획이 없어요.":"이 날짜에 완료한 복용 기록이 없어요."}</p>}
    <details><summary>색상과 계산 기준</summary>
      <p>연녹색은 미국 라벨 기준치의 50% 미만, 녹색은 50~100%, 주황색은 100% 초과입니다. 빨간색은 확인된 양만으로 지원하는 상한 기준을 넘은 경우(현재 비타민 D3)에 표시해요. 식사와 미등록 제품이 제외되어요.</p>
      <p>복용량에 <b>1</b>을 입력하면 제품 라벨의 단위를 붙여 1정 또는 1스쿱으로 계산해요. 실제 복용 표에는 기록할 당시 저장한 성분표를 사용합니다.</p>
      <p>직접 입력한 값은 라벨 확인을 마친 것으로 간주하지 않아요. 일부만 가져온 성분표와 직접 입력한 제품의 나머지 항목은 빈칸으로 유지하며, 과거 실제 복용 기록은 변경하지 않아요.</p>
      <a href="https://www.fda.gov/food/nutrition-facts-label/daily-value-new-nutrition-and-supplement-facts-labels" target="_blank" rel="noreferrer">FDA 라벨 기준치</a>{" · "}
      <a href="https://ods.od.nih.gov/factsheets/VitaminD-Consumer/" target="_blank" rel="noreferrer">NIH 비타민 D 상한</a>
    </details>
  </section>;
}
