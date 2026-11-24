"use client";
import { nutrientDisplayName,normalizedNutrient } from "@/lib/supplement-nutrients";
import { defaultUpperTarget,kdriSource,upperAgeGroups,type UpperTarget } from "@/lib/supplement-upper-limits";
import { useState } from "react";
import { localDate,type AppState } from "@/lib/model";
import { intakeStatus,intakeColumnIncomplete,nutrientKey,supplementIntake } from "@/lib/supplement-intake";
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
  const [target,setTarget]=useState<UpperTarget>(defaultUpperTarget);
  const cancel=(id:string)=>setDrafts(old=>{const next={...old};delete next[id];return next;});
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
      <div><h2 id="intake-table-title">1일 영양소 섭취표</h2><p>2025 KDRI 상한섭취량 대비 · 영양제에서 확인한 양 · 식사 제외</p></div>
      <Input label="섭취표 날짜" type="date" value={date} onChange={value=>{if(/^\d{4}-\d{2}-\d{2}$/.test(value)){setDate(value);setDrafts({});setNotice("");}}}/>
    </header>
    <div className="space-tabs" role="group" aria-label="섭취 합계 방식">
      <button type="button" aria-pressed={mode==="plan"} onClick={()=>{setMode("plan");setDrafts({});setNotice("");}}>복용 계획 기준</button>
      <button type="button" aria-pressed={mode==="actual"} onClick={()=>{setMode("actual");setDrafts({});setNotice("");}}>실제 복용</button>
    </div>
    <details className={styles.target}><summary>비교 대상 설정 · {target.age==="adult"?"19세 이상 성인 공통 참고값":target.age+"세"} · {target.stage==="pregnant"?"임신부":target.stage==="lactating"?"수유부":target.sex==="all"?"성별 공통":target.sex==="male"?"남자":"여자"}</summary>
      <p>개인 정보와 별개인 이 표의 참고 대상이에요. 값이 달라지는 항목은 대상을 선택해야 비율을 표시해요. 선택은 현재 화면에서만 유지돼요.</p>
      <div className={styles.targetFields}>
        <label>연령<select value={target.age} onChange={e=>setTarget(t=>({...t,age:e.target.value as UpperTarget["age"]}))}><option value="adult">19세 이상 공통</option>{upperAgeGroups.map(age=><option key={age} value={age}>{age==="75+"?"75세 이상":age+"세"}</option>)}</select></label>
        <label>성별<select value={target.stage!=="general"?"female":target.sex} disabled={target.stage!=="general"} onChange={e=>setTarget(t=>({...t,sex:e.target.value as UpperTarget["sex"]}))}><option value="all">공통 참고값</option><option value="male">남자</option><option value="female">여자</option></select></label>
        <label>생애주기<select value={target.stage} onChange={e=>setTarget(t=>({...t,stage:e.target.value as UpperTarget["stage"]}))}><option value="general">일반</option><option value="pregnant">임신부</option><option value="lactating">수유부</option></select></label>
      </div>
    </details>
    <p className={styles.notice}>상한은 매일 채우는 목표량이 아니에요. 상한 미만 표시는 적정량·안전성을 보장하지 않으며, 식사와 미등록 제품의 양은 합계에 포함되지 않아요.</p>
    {missingCount>0&&<p className={styles.notice}>제품 {missingCount}개의 라벨 또는 복용량이 일부 확인되지 않았어요. 표에는 확인된 양만 표시해요. 색상도 확인된 양의 기준 비율이며, 미확인 항목이 있으면 최종 합계가 달라질 수 있어요.</p>}
    <p className={styles.notice}>- : 표기 없거나 미확인인 값. 확인이 필요한 제품은 ‘수정’을 누르면 미확인 칸을 입력할 수 있어요. 입력은 제품 제공량 기준이며, 저장 후 복용량·횟수로 하루 합계를 계산해요.</p>
    {notice&&<p role="status">{notice}</p>}
    {rows.length>0?<div className={styles.scroll} role="region" aria-label="제품별 영양소 섭취량" tabIndex={0}>
      <table>
        <thead><tr><th scope="col">영양제</th>{columns.length?columns.map(column=><th key={nutrientKey(column)} scope="col">{nutrientDisplayName(column.name)}<small>{column.unit}</small></th>):<th scope="col">성분표</th>}</tr></thead>
        <tbody>
          <tr><th scope="row">1일 확인 합계</th>{columns.length?columns.map(column=>{
            const key=nutrientKey(column),value=totals[key],status=intakeStatus(column,value,intakeColumnIncomplete(rows,column),target);
            return <td key={key} className={styles[status.level]} title={`${status.referenceText} · ${status.scope}`}>
              <b>{value===undefined?"—":`${status.incomplete?"≥ ":""}${format.format(value)}`}</b>{status.percent!==undefined&&<small>{"상한 대비 "}{format.format(status.percent)}%</small>}<small>{status.reference?"상한 ":""}{status.referenceText}</small><small>{status.label}</small>{status.incomplete&&<small className={styles.incomplete}>일부 미확인 · 최종 합계 미확정</small>}
            </td>;
          }):<td>판정 보류</td>}</tr>
          {rows.map(row=><tr key={row.id}>
            <th scope="row">{row.name}<small>{row.occurrences}회{row.missing?" · 확인 필요":""}</small>{mode==="plan"&&row.unconfirmed&&onSaveProduct&&(()=>{
              const product=journal.products.find(p=>p.id===row.id);if(!product)return null;
              if(row.uncertainKeys.length)return <button type="button" className="text-link" disabled={busy||!onEditProduct} onClick={()=>onEditProduct?.(row.id)}>중복 성분 확인</button>;
              if(!drafts[row.id])return <button type="button" className="text-link" disabled={busy} aria-label={`${row.name} 영양소 수정`} onClick={()=>{setNotice("");change(row.id,{values:{}});}}>수정</button>;
              return <div className={styles.editor}><small>직접 입력 · {product.label?.servingSize??1}{product.label?.servingUnit??drafts[row.id]?.unit??"정"}당</small>
                {!product.label&&<label>단위<select aria-label={`${row.name} 제공량 단위`} value={drafts[row.id]?.unit??"정"} disabled={busy} onChange={e=>change(row.id,{unit:e.target.value as SupplementLabel["servingUnit"]})}>{supplementServingUnits.map(unit=><option key={unit}>{unit}</option>)}</select></label>}
                <details><summary>계산용 개수 변경</summary><label>1회 복용 개수<input aria-label={`${row.name} 1회 복용 개수`} inputMode="decimal" value={drafts[row.id]?.dose??product.dose} disabled={busy} onChange={e=>change(row.id,{dose:e.target.value})}/></label></details>
                <button type="button" className="text-link" disabled={busy||(!Object.keys(drafts[row.id].values).length&&drafts[row.id].dose===undefined&&drafts[row.id].unit===undefined)} onClick={()=>void save(row.id)}>입력 저장</button>
                <button type="button" className="text-link" disabled={busy} aria-label={`${row.name} 영양소 수정 취소`} onClick={()=>{cancel(row.id);setNotice("");}}>취소</button>
              </div>;
            })()}</th>
            {columns.length?columns.map(column=>{
              const key=nutrientKey(column),amount=row.amounts[key];
              const product=journal.products.find(p=>p.id===row.id),fact=product?.label?.facts.find(f=>nutrientKey(f)===key);
              const editable=mode==="plan"&&onSaveProduct&&row.unconfirmed&&!!drafts[row.id]&&(!row.knownKeys.includes(key)||fact?.manual);
              if(editable)return <td key={key}><input className={styles.amountInput} type="text" inputMode="decimal" aria-label={`${row.name} ${column.name} ${column.unit} 직접 입력`} disabled={busy}
                value={drafts[row.id]?.values[key]??(fact?.manual?String(normalizedNutrient(fact).amount):"")} onChange={e=>change(row.id,{values:{...drafts[row.id]?.values,[key]:e.target.value}})}/></td>;
              return <td key={key}>{amount!==undefined?`${format.format(amount)}${row.doseUnknown?" 이상":""}`:row.knownKeys.includes(key)?<button type="button" className="text-link" disabled={mode!=="plan"||!onEditProduct||busy} onClick={()=>onEditProduct?.(row.id)}>복용량 입력</button>:"-"}</td>;
            }):<td>확인 필요</td>}
          </tr>)}
        </tbody>
      </table>
    </div>:<p className={styles.notice}>{mode==="plan"?"이 날짜에 등록된 복용 계획이 없어요.":"이 날짜에 완료한 복용 기록이 없어요."}</p>}
    <details><summary>색상과 계산 기준</summary>
      <p>상한의 90% 미만은 중립색, 90% 이상~100% 미만은 주황색, 100%는 상한 도달, 100% 초과는 빨간색으로 표시해요. 90%는 서비스의 시각적 안내선이며 KDRI의 별도 의학적 판정선이 아니에요. 상한 초과는 검토 신호이며 독성 발생을 진단하는 의미가 아니에요.</p>
      <p>보건복지부·한국영양학회, 2025 한국인 영양소 섭취기준 요약표 xii~xviii의 상한섭취량을 사용해요. 일반 영양소는 식사 포함 기준이지만 이 표에는 영양제만 합산해요. 마그네슘은 식품 외 급원의 상한과 비교해요. 단백질·비타민 B1/B2/B12·칼륨 등 상한이 설정되지 않은 성분은 판정을 보류해요.</p>
      <p>비타민 A는 레티놀 함량, 비타민 E는 α-TE 단위, 니아신은 니코틴산·니코틴아미드 형태를 확인해야 해요. 엽산 DFE는 폴릭산 함량으로 임의 환산하지 않아요. 해당 정보가 부족하면 원래 함량과 상한은 보여주되 색상 판정을 보류해요. 임신부·수유부 요오드는 상한 미설정이며, 15~18세 임신·수유는 이 표에서 자동 비교하지 않아요.</p>
      <p>명확한 하루 섭취 안내가 있으면 등록 시 기본값으로 제시하고, 없으면 라벨 1회 제공량을 계산 기준으로 적용해요. 기준 비율을 맞추기 위해 복용 개수를 늘리지 않아요. 실제 복용 표에는 기록할 당시의 성분표와 복용량을 사용합니다.</p>
      <p>직접 입력한 값은 라벨 확인을 마친 것으로 간주하지 않아요. 미확인 항목은 평소 ‘-’로 표시하고 수정 중에만 빈칸으로 보여요. 표시가 같아도 표기 없음과 미확인은 구분하여 계산하며, 과거 실제 복용 기록은 변경하지 않아요.</p>
      <a href={kdriSource} target="_blank" rel="noreferrer">2025 KDRI 원문·요약표 보기</a>
    </details>
  </section>;
}
